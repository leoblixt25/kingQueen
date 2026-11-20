import type { PlayerGender, PlayerRegistration } from "./types";
import type {
  GsdeTournamentDocument,
  PlayerPairingIndex,
} from "./persistence";

/**
 * Pure helpers for self-service player registration.
 *
 * Registration is individual and approval is independent from team creation.
 * Records are stored ONLY in the isolated `tournaments/{id}` document. The
 * Firebase Auth uid is the identity; an admin approves the player first, then
 * either the players or the admin create a two-player team. This module has no
 * React or Firebase dependency.
 */

export interface RegistrationDraft {
  uid: string;
  email: string;
  name: string;
  gender: PlayerGender;
}

export interface RegistrationIssue {
  field: "uid" | "email" | "name" | "gender";
  message: string;
}

export const PLAYER_GENDER_OPTIONS: ReadonlyArray<{
  value: PlayerGender;
  label: string;
}> = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
];

/** Emails are stored and compared lower-cased, matching the K&Q convention. */
export const normalizeRegistrationEmail = (email: string): string =>
  email.trim().toLowerCase();

export const getRegistrations = (
  doc: GsdeTournamentDocument
): PlayerRegistration[] => doc.registrations ?? [];

/**
 * The active team for a player is membership in a confirmed team. Registration
 * `teamId` is kept for admin-managed records, but accepted player invitations
 * do not need to rewrite registrations to establish membership.
 */
export const getTeamIdForPlayer = (
  doc: GsdeTournamentDocument,
  uid: string
): string | null => {
  const membership = doc.teams.find(
    (team) => team.status !== "pending" && team.playerIds.includes(uid)
  );
  return membership?.id ?? null;
};

/**
 * Rebuild the rules-visible pairing index from the authoritative records.
 * Called on every committed GSDE change so the index can never drift.
 */
export const rebuildPlayerPairingIndex = (
  doc: GsdeTournamentDocument
): PlayerPairingIndex => {
  const index: PlayerPairingIndex = {};
  for (const registration of getRegistrations(doc)) {
    index[registration.uid] = {
      status: registration.status,
      teamId: registration.status === "approved"
        ? getTeamIdForPlayer(doc, registration.uid)
        : null,
    };
  }
  return index;
};

export const withPlayerPairingIndex = (
  doc: GsdeTournamentDocument
): GsdeTournamentDocument => ({
  ...doc,
  playerPairingIndex: rebuildPlayerPairingIndex(doc),
});

/** An approved player with no active team may use partner finding. */
export const isApprovedUnpairedPlayer = (
  doc: GsdeTournamentDocument,
  uid: string
): boolean => {
  const registration = findRegistrationByUid(doc, uid);
  return (
    registration?.status === "approved" && !getTeamIdForPlayer(doc, uid)
  );
};

/** Validate the player-supplied fields before any mutation is attempted. */
export const validateRegistrationDraft = (
  draft: RegistrationDraft
): RegistrationIssue[] => {
  const issues: RegistrationIssue[] = [];
  if (!draft.uid || !draft.uid.trim()) {
    issues.push({ field: "uid", message: "A signed-in account is required." });
  }
  if (!normalizeRegistrationEmail(draft.email)) {
    issues.push({ field: "email", message: "Enter a valid email address." });
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeRegistrationEmail(draft.email))) {
    issues.push({ field: "email", message: "Enter a valid email address." });
  }
  const name = draft.name.trim();
  if (name.length < 2) {
    issues.push({ field: "name", message: "Enter your name (at least 2 characters)." });
  }
  if (draft.gender !== "male" && draft.gender !== "female") {
    issues.push({ field: "gender", message: "Select your player gender." });
  }
  return issues;
};

export const findRegistrationByUid = (
  doc: GsdeTournamentDocument,
  uid: string
): PlayerRegistration | undefined =>
  uid ? getRegistrations(doc).find((item) => item.uid === uid) : undefined;

export const findRegistrationByEmail = (
  doc: GsdeTournamentDocument,
  email: string
): PlayerRegistration | undefined => {
  const normalized = normalizeRegistrationEmail(email);
  return normalized
    ? getRegistrations(doc).find((item) => normalizeRegistrationEmail(item.email) === normalized)
    : undefined;
};

/**
 * The team a signed-in player is allowed to see. Approval is checked first, and
 * the link comes from actual team membership — never from an invitation. This
 * is what keeps pending players out of teams and prevents duplicate pairings.
 */
export const getRegisteredTeamId = (
  doc: GsdeTournamentDocument,
  uid: string
): string | null => {
  const registration = findRegistrationByUid(doc, uid);
  if (registration?.status !== "approved") return null;
  const membership = getTeamIdForPlayer(doc, uid);
  if (membership) return membership;
  // Admin-managed records can still carry an explicit team id; accept it only
  // when it resolves to a real team that contains the player.
  return registration.teamId &&
    doc.teams.some(
      (team) => team.id === registration.teamId && team.playerIds.includes(uid)
    )
    ? registration.teamId
    : null;
};

export interface RegistrationStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  assigned: number;
  approvedUnpaired: number;
}

export const getRegistrationStats = (
  doc: GsdeTournamentDocument
): RegistrationStats => {
  const registrations = getRegistrations(doc);
  return {
    total: registrations.length,
    pending: registrations.filter((item) => item.status === "pending").length,
    approved: registrations.filter((item) => item.status === "approved").length,
    rejected: registrations.filter((item) => item.status === "rejected").length,
    assigned: registrations.filter(
      (item) => item.status === "approved" && Boolean(getRegisteredTeamId(doc, item.uid))
    ).length,
    approvedUnpaired: registrations.filter((item) =>
      isApprovedUnpairedPlayer(doc, item.uid)
    ).length,
  };
};

/** Registrations awaiting an admin decision, oldest first. */
export const selectPendingRegistrations = (
  doc: GsdeTournamentDocument
): PlayerRegistration[] =>
  getRegistrations(doc)
    .filter((item) => item.status === "pending")
    .sort((a, b) => a.registeredAt.localeCompare(b.registeredAt));

export const selectRegistrationsByStatus = (
  doc: GsdeTournamentDocument,
  status: PlayerRegistration["status"]
): PlayerRegistration[] =>
  getRegistrations(doc).filter((item) => item.status === status);

/** Approved players still waiting for a partner, oldest first. */
export const selectApprovedUnpairedRegistrations = (
  doc: GsdeTournamentDocument
): PlayerRegistration[] =>
  getRegistrations(doc)
    .filter((item) => isApprovedUnpairedPlayer(doc, item.uid))
    .sort((a, b) => a.registeredAt.localeCompare(b.registeredAt));
