import type { AuditActor } from "./audit";
import {
  derivePairTeamName,
  isPairValidForCategory,
  normalizeTournamentCategory,
} from "./category";
import type { GsdeTournamentDocument } from "./persistence";
import {
  findRegistrationByUid,
  getRegisteredTeamId,
  getRegistrations,
} from "./registration";
import {
  assertRegistrationOpen,
  commitGsdeChange,
  ScoringError,
} from "./scoring";
import type {
  PairingInvitation,
  PairingResponseMap,
  PlayerGender,
  PlayerId,
  PlayerRegistration,
  Team,
  TeamId,
} from "./types";

/**
 * Player-to-player pairing for the isolated 2x2 format.
 *
 * Registrations, invitations and teams stay separate: sending an invitation
 * never creates a team or changes a registration, and accepting one creates a
 * pending fixed pair while both players remain registered individuals. Admin
 * approval is still required before the pair can enter the tournament engine.
 */

type PairErrorCode =
  | "pairing-invalid"
  | "pairing-not-found"
  | "pairing-unavailable";

const fail = (code: PairErrorCode, message: string): never => {
  throw new ScoringError(code, message);
};

const stamp = (): string => new Date().toISOString();

const touch = (doc: GsdeTournamentDocument): GsdeTournamentDocument => ({
  ...doc,
  tournament: { ...doc.tournament, updatedAt: stamp() },
});

const sanitizeIdPart = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "player";

/** Stable team id derived from both players, so acceptance is idempotent. */
export const createPairTeamId = (
  firstUid: PlayerId,
  secondUid: PlayerId
): TeamId => `pair-${sanitizeIdPart(firstUid)}-${sanitizeIdPart(secondUid)}`;

const actorForPlayer = (
  registration: PlayerRegistration
): AuditActor => ({
  id: registration.uid,
  label: registration.name || registration.email,
  isAdmin: false,
});

export const getPairingInvitations = (
  doc: GsdeTournamentDocument
): PairingInvitation[] => Object.values(doc.pairingInvitations ?? {});

export const getPairingResponses = (
  doc: GsdeTournamentDocument
): PairingResponseMap => doc.pairingResponses ?? {};

export const findInvitationByInviter = (
  doc: GsdeTournamentDocument,
  inviterUid: PlayerId
): PairingInvitation | undefined => doc.pairingInvitations?.[inviterUid];

const activeInvitationFor = (
  doc: GsdeTournamentDocument,
  uid: PlayerId
): PairingInvitation | undefined =>
  getPairingInvitations(doc).find(
    (invitation) =>
      (invitation.status === "pending" || invitation.status === "accepted") &&
      (invitation.inviterUid === uid || invitation.inviteeUid === uid)
  );

/** Registration closes when the group stage starts; compositions lock with it. */
export const isPairingLocked = (doc: GsdeTournamentDocument): boolean =>
  doc.tournament.status !== "draft" && doc.tournament.status !== "configured";

const requirePairableRegistration = (
  doc: GsdeTournamentDocument,
  uid: PlayerId
): PlayerRegistration => {
  const registration = findRegistrationByUid(doc, uid);
  if (!registration || registration.status === "rejected") {
    fail("pairing-invalid", "Both players must be registered for this tournament.");
  }
  if (registration.gender !== "male" && registration.gender !== "female") {
    fail("pairing-invalid", "Both players need a gender before they can be paired.");
  }
  return registration;
};

const validatePair = (
  doc: GsdeTournamentDocument,
  firstUid: PlayerId,
  secondUid: PlayerId,
  ignoreTeamId?: TeamId
): [PlayerRegistration, PlayerRegistration] => {
  if (!firstUid || !secondUid || firstUid === secondUid) {
    fail("pairing-invalid", "A pair needs two different registered players.");
  }
  const first = requirePairableRegistration(doc, firstUid);
  const second = requirePairableRegistration(doc, secondUid);
  const category = normalizeTournamentCategory(doc.tournament.config.category);
  if (
    !isPairValidForCategory(category, [
      first.gender as PlayerGender,
      second.gender as PlayerGender,
    ])
  ) {
    fail("pairing-unavailable", `This pair is not compatible with the ${category} category.`);
  }

  for (const uid of [firstUid, secondUid]) {
    const teamId = getRegisteredTeamId(doc, uid);
    if (teamId && teamId !== ignoreTeamId) {
      fail("pairing-unavailable", "A player in this pair already belongs to a team.");
    }
  }
  return [first, second];
};

const ensureNoConflictingInvitation = (
  doc: GsdeTournamentDocument,
  firstUid: PlayerId,
  secondUid: PlayerId,
  ignoreInviterUid?: PlayerId,
  ignoreTeamId?: TeamId
): void => {
  const conflict = getPairingInvitations(doc).find(
    (invitation) =>
      (invitation.status === "pending" || invitation.status === "accepted") &&
      invitation.id !== ignoreInviterUid &&
      invitation.teamId !== ignoreTeamId &&
      [invitation.inviterUid, invitation.inviteeUid].some(
        (uid) => uid === firstUid || uid === secondUid
      )
  );
  if (conflict) {
    fail("pairing-unavailable", "One of these players already has an active pairing invitation.");
  }
};

const buildPendingPairTeam = (
  doc: GsdeTournamentDocument,
  first: PlayerRegistration,
  second: PlayerRegistration,
  id: TeamId
): Team => ({
  id,
  name: derivePairTeamName([first.name, second.name]),
  playerIds: [first.uid, second.uid],
  seed: null,
  groupId: null,
  status: "pending",
  nameIsCustom: false,
});

/** Player A invites a compatible, unpaired registered player B. */
export const sendPairingInvitation = (
  doc: GsdeTournamentDocument,
  inviterUid: PlayerId,
  inviteeUid: PlayerId,
  actor?: AuditActor
): GsdeTournamentDocument => {
  assertRegistrationOpen(doc);
  const [inviter, invitee] = validatePair(doc, inviterUid, inviteeUid);
  const existing = findInvitationByInviter(doc, inviterUid);
  if (
    existing &&
    (existing.status === "pending" || existing.status === "accepted")
  ) {
    fail("pairing-unavailable", "You already have an active pairing invitation.");
  }
  ensureNoConflictingInvitation(doc, inviterUid, inviteeUid);

  const now = stamp();
  const invitation: PairingInvitation = {
    id: inviterUid,
    inviterUid,
    inviteeUid,
    category: normalizeTournamentCategory(doc.tournament.config.category),
    status: "pending",
    createdAt: now,
    respondedAt: null,
    teamId: null,
  };
  return commitGsdeChange(
    touch({
      ...doc,
      pairingInvitations: {
        ...(doc.pairingInvitations ?? {}),
        [inviterUid]: invitation,
      },
    }),
    {
      action: "pairing-invitation-sent",
      actor: actor ?? actorForPlayer(inviter),
      detail: `${inviter.name} invited ${invitee.name} to form a team.`,
    }
  );
};

/** Invitee accepts a pending invitation; a pending fixed team is created. */
export const acceptPairingInvitation = (
  doc: GsdeTournamentDocument,
  inviteeUid: PlayerId,
  inviterUid: PlayerId,
  actor?: AuditActor
): GsdeTournamentDocument => {
  assertRegistrationOpen(doc);
  const invitation = findInvitationByInviter(doc, inviterUid);
  if (!invitation || invitation.inviteeUid !== inviteeUid) {
    fail("pairing-not-found", "That pairing invitation was not found for your account.");
  }
  if (invitation.status !== "pending") {
    fail("pairing-invalid", "That pairing invitation is no longer pending.");
  }

  const [inviter, invitee] = validatePair(doc, inviterUid, inviteeUid);
  ensureNoConflictingInvitation(doc, inviterUid, inviteeUid, inviterUid);

  const teamId = createPairTeamId(inviterUid, inviteeUid);
  if (doc.teams.some((team) => team.id === teamId)) {
    fail("pairing-unavailable", "A team already exists for this player pair.");
  }
  const now = stamp();
  const team = buildPendingPairTeam(doc, inviter, invitee, teamId);
  return commitGsdeChange(
    touch({
      ...doc,
      teams: [...doc.teams, team],
      pairingInvitations: {
        ...(doc.pairingInvitations ?? {}),
        [inviterUid]: {
          ...invitation,
          status: "accepted",
          respondedAt: now,
          teamId,
        },
      },
      pairingResponses: {
        ...(doc.pairingResponses ?? {}),
        [inviteeUid]: {
          invitationId: inviterUid,
          status: "accepted",
          teamId,
          respondedAt: now,
        },
      },
    }),
    {
      action: "pairing-invitation-accepted",
      actor: actor ?? actorForPlayer(invitee),
      teamId,
      detail: `${inviter.name} and ${invitee.name} formed a pending team.`,
    }
  );
};

/** Invitee declines a pending invitation; no team is created. */
export const declinePairingInvitation = (
  doc: GsdeTournamentDocument,
  inviteeUid: PlayerId,
  inviterUid: PlayerId,
  actor?: AuditActor
): GsdeTournamentDocument => {
  const invitation = findInvitationByInviter(doc, inviterUid);
  if (!invitation || invitation.inviteeUid !== inviteeUid) {
    fail("pairing-not-found", "That pairing invitation was not found for your account.");
  }
  if (invitation.status !== "pending") {
    fail("pairing-invalid", "That pairing invitation is no longer pending.");
  }
  const invitee = requirePairableRegistration(doc, inviteeUid);
  const now = stamp();
  return commitGsdeChange(
    touch({
      ...doc,
      pairingInvitations: {
        ...(doc.pairingInvitations ?? {}),
        [inviterUid]: {
          ...invitation,
          status: "declined",
          respondedAt: now,
          teamId: null,
        },
      },
      pairingResponses: {
        ...(doc.pairingResponses ?? {}),
        [inviteeUid]: {
          invitationId: inviterUid,
          status: "declined",
          teamId: null,
          respondedAt: now,
        },
      },
    }),
    {
      action: "pairing-invitation-declined",
      actor: actor ?? actorForPlayer(invitee),
      detail: `${invitee.name} declined a pairing invitation.`,
    }
  );
};

/** Inviter withdraws their own still-pending invitation. */
export const cancelPairingInvitation = (
  doc: GsdeTournamentDocument,
  inviterUid: PlayerId,
  actor?: AuditActor
): GsdeTournamentDocument => {
  const invitation = findInvitationByInviter(doc, inviterUid);
  const inviter = findRegistrationByUid(doc, inviterUid);
  if (!invitation || !inviter) {
    fail("pairing-not-found", "That pairing invitation was not found.");
  }
  if (invitation.status !== "pending") {
    fail("pairing-invalid", "Only a pending invitation can be withdrawn.");
  }
  return commitGsdeChange(
    touch({
      ...doc,
      pairingInvitations: {
        ...(doc.pairingInvitations ?? {}),
        [inviterUid]: {
          ...invitation,
          status: "cancelled",
          respondedAt: stamp(),
          teamId: null,
        },
      },
    }),
    {
      action: "pairing-invitation-cancelled",
      actor: actor ?? actorForPlayer(inviter),
      detail: `${inviter.name} withdrew a pairing invitation.`,
    }
  );
};

/** Admin manually creates a pending team from two registered players. */
export const adminCreatePairTeam = (
  doc: GsdeTournamentDocument,
  firstUid: PlayerId,
  secondUid: PlayerId,
  actor: AuditActor
): GsdeTournamentDocument => {
  assertRegistrationOpen(doc);
  if (doc.matches.length > 0 || doc.groups.length > 0) {
    fail("pairing-invalid", "Team compositions are locked after group generation.");
  }
  const [first, second] = validatePair(doc, firstUid, secondUid);
  ensureNoConflictingInvitation(doc, firstUid, secondUid);
  const teamId = createPairTeamId(firstUid, secondUid);
  if (doc.teams.some((team) => team.id === teamId)) {
    fail("pairing-unavailable", "A team already exists for this player pair.");
  }
  const now = stamp();
  const team = buildPendingPairTeam(doc, first, second, teamId);
  return commitGsdeChange(
    touch({
      ...doc,
      teams: [...doc.teams, team],
      registrations: getRegistrations(doc).map((item) =>
        item.uid === firstUid || item.uid === secondUid
          ? { ...item, status: "approved" as const, teamId, decidedAt: now }
          : item
      ),
      pairingInvitations: {
        ...(doc.pairingInvitations ?? {}),
        [firstUid]: {
          id: firstUid,
          inviterUid: firstUid,
          inviteeUid: secondUid,
          category: normalizeTournamentCategory(doc.tournament.config.category),
          status: "accepted",
          createdAt: now,
          respondedAt: now,
          teamId,
        },
      },
      pairingResponses: {
        ...(doc.pairingResponses ?? {}),
        [secondUid]: {
          invitationId: firstUid,
          status: "accepted",
          teamId,
          respondedAt: now,
        },
      },
    }),
    {
      action: "pairing-team-created",
      actor,
      teamId,
      detail: `Admin created a pending pair for ${first.name} and ${second.name}.`,
    }
  );
};

/** Admin changes the two players on an existing team, keeping its team id. */
export const adminChangePairing = (
  doc: GsdeTournamentDocument,
  teamId: TeamId,
  firstUid: PlayerId,
  secondUid: PlayerId,
  actor: AuditActor
): GsdeTournamentDocument => {
  assertRegistrationOpen(doc);
  if (doc.matches.length > 0 || doc.groups.length > 0) {
    fail("pairing-invalid", "Team compositions are locked after group generation.");
  }
  const team = doc.teams.find((item) => item.id === teamId);
  if (!team) fail("pairing-not-found", `No team "${teamId}".`);
  const [first, second] = validatePair(doc, firstUid, secondUid, teamId);
  ensureNoConflictingInvitation(doc, firstUid, secondUid, undefined, teamId);

  const now = stamp();
  const previousUids = team.playerIds;
  const nextPlayerIds = [firstUid, secondUid];
  const invitations = { ...(doc.pairingInvitations ?? {}) };
  for (const invitation of getPairingInvitations(doc)) {
    if (
      invitation.teamId === teamId ||
      (invitation.status === "pending" &&
        [invitation.inviterUid, invitation.inviteeUid].some((uid) =>
          nextPlayerIds.includes(uid)
        ))
    ) {
      invitations[invitation.id] = {
        ...invitation,
        status: "cancelled",
        respondedAt: now,
        teamId: null,
      };
    }
  }
  invitations[firstUid] = {
    id: firstUid,
    inviterUid: firstUid,
    inviteeUid: secondUid,
    category: normalizeTournamentCategory(doc.tournament.config.category),
    status: "accepted",
    createdAt: now,
    respondedAt: now,
    teamId,
  };
  const responses: PairingResponseMap = { ...(doc.pairingResponses ?? {}) };
  for (const [uid, response] of Object.entries(responses)) {
    if (response.invitationId === teamId || response.teamId === teamId) {
      delete responses[uid];
    }
  }
  responses[secondUid] = {
    invitationId: firstUid,
    status: "accepted",
    teamId,
    respondedAt: now,
  };

  return commitGsdeChange(
    touch({
      ...doc,
      teams: doc.teams.map((item) =>
        item.id === teamId
          ? {
              ...item,
              playerIds: nextPlayerIds,
              name: item.nameIsCustom
                ? item.name
                : derivePairTeamName([first.name, second.name]),
              status: "pending" as const,
            }
          : item
      ),
      registrations: getRegistrations(doc).map((item) => {
        if (nextPlayerIds.includes(item.uid)) {
          return { ...item, status: "approved" as const, teamId, decidedAt: now };
        }
        if (previousUids.includes(item.uid) && item.teamId === teamId) {
          return { ...item, status: "pending" as const, teamId: null, decidedAt: null };
        }
        return item;
      }),
      pairingInvitations: invitations,
      pairingResponses: responses,
    }),
    {
      action: "pairing-team-changed",
      actor,
      teamId,
      detail: `Admin changed the pair to ${first.name} and ${second.name}.`,
    }
  );
};

/** Admin removes a pair and detaches both registrations from it. */
export const adminRemovePairing = (
  doc: GsdeTournamentDocument,
  teamId: TeamId,
  actor: AuditActor
): GsdeTournamentDocument => {
  assertRegistrationOpen(doc);
  if (doc.matches.length > 0 || doc.groups.length > 0) {
    fail("pairing-invalid", "Team compositions are locked after group generation.");
  }
  const team = doc.teams.find((item) => item.id === teamId);
  if (!team) fail("pairing-not-found", `No team "${teamId}".`);
  const now = stamp();
  const invitations = { ...(doc.pairingInvitations ?? {}) };
  for (const invitation of getPairingInvitations(doc)) {
    if (invitation.teamId === teamId) {
      invitations[invitation.id] = {
        ...invitation,
        status: "cancelled",
        respondedAt: now,
        teamId: null,
      };
    }
  }
  const responses: PairingResponseMap = { ...(doc.pairingResponses ?? {}) };
  for (const [uid, response] of Object.entries(responses)) {
    if (response.teamId === teamId) delete responses[uid];
  }

  return commitGsdeChange(
    touch({
      ...doc,
      teams: doc.teams.filter((item) => item.id !== teamId),
      registrations: getRegistrations(doc).map((item) =>
        item.teamId === teamId
          ? { ...item, status: "pending" as const, teamId: null, decidedAt: null }
          : item
      ),
      pairingInvitations: invitations,
      pairingResponses: responses,
    }),
    {
      action: "pairing-team-removed",
      actor,
      teamId,
      detail: `Admin removed the pair "${team.name}".`,
    }
  );
};

/** Pending invitations where this player is the invitee, oldest first. */
export const selectPendingInvitationsForPlayer = (
  doc: GsdeTournamentDocument,
  uid: PlayerId
): PairingInvitation[] =>
  getPairingInvitations(doc)
    .filter(
      (invitation) =>
        invitation.inviteeUid === uid && invitation.status === "pending"
    )
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

/** Compatible registered players the viewer can still invite. */
export const selectAvailablePlayers = (
  doc: GsdeTournamentDocument,
  viewerUid: PlayerId
): PlayerRegistration[] => {
  if (isPairingLocked(doc) || !findRegistrationByUid(doc, viewerUid)) return [];
  if (getRegisteredTeamId(doc, viewerUid)) return [];
  const viewer = findRegistrationByUid(doc, viewerUid);
  if (
    !viewer ||
    viewer.status === "rejected" ||
    (viewer.gender !== "male" && viewer.gender !== "female")
  ) {
    return [];
  }
  const category = normalizeTournamentCategory(doc.tournament.config.category);
  return getRegistrations(doc).filter((candidate) => {
    if (candidate.uid === viewerUid || candidate.status === "rejected") return false;
    if (candidate.gender !== "male" && candidate.gender !== "female") return false;
    if (!isPairValidForCategory(category, [viewer.gender as PlayerGender, candidate.gender])) {
      return false;
    }
    if (getRegisteredTeamId(doc, candidate.uid)) return false;
    return !activeInvitationFor(doc, candidate.uid);
  });
};

/** Registered players who are not yet linked to any team or accepted pair. */
export const selectUnpairedPlayers = (
  doc: GsdeTournamentDocument
): PlayerRegistration[] =>
  getRegistrations(doc).filter(
    (registration) =>
      registration.status !== "rejected" &&
      !getRegisteredTeamId(doc, registration.uid)
  );

export type PairingStatus =
  | "paired"
  | "invite-sent"
  | "invite-received"
  | "searching"
  | "not-registered";

export const getPairingStatusForPlayer = (
  doc: GsdeTournamentDocument,
  uid: PlayerId
): PairingStatus => {
  if (!findRegistrationByUid(doc, uid)) return "not-registered";
  if (getRegisteredTeamId(doc, uid)) return "paired";
  const invitations = getPairingInvitations(doc);
  if (
    invitations.some(
      (invitation) =>
        invitation.inviterUid === uid && invitation.status === "pending"
    )
  ) {
    return "invite-sent";
  }
  if (
    invitations.some(
      (invitation) =>
        invitation.inviteeUid === uid && invitation.status === "pending"
    )
  ) {
    return "invite-received";
  }
  return "searching";
};
