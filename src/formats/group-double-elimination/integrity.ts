import type { GsdeTournamentDocument } from "./persistence";
import type { MatchId, TeamId } from "./types";
import { getLoser, getWinner, hasDecidableScores, deriveWinner } from "./matchResult";
import { listEliminationMatches } from "./bracket";
import { isGroupStageMatchComplete } from "./groupStageMatches";
import { normalizeTournamentCategory, validateTeamsForCategory } from "./category";

/**
 * Central integrity checks. A transition is only allowed to persist if the
 * resulting document passes these checks; a completed match can therefore
 * never leave the bracket in a silently inconsistent state.
 */

export type IntegrityCode =
  | "duplicate-team-id"
  | "duplicate-group-id"
  | "duplicate-group-match-id"
  | "duplicate-elimination-match-id"
  | "overlapping-match-id"
  | "invalid-group-size"
  | "incomplete-group-match"
  | "invalid-group-participants"
  | "invalid-seed-count"
  | "invalid-elimination-result"
  | "winner-score-mismatch"
  | "broken-progression-link"
  | "duplicate-registration-uid"
  | "duplicate-registration-email"
  | "invalid-registration-team"
  | "invalid-team-category"
  | "invalid-team-size"
  | "invalid-pairing-invitation"
  | "invalid-pairing-response"
  | "invalid-pairing-team"
  | "duplicate-player-pairing";

export interface IntegrityIssue {
  code: IntegrityCode;
  message: string;
}

const duplicates = (values: readonly string[]): string[] => {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) repeated.add(value);
    seen.add(value);
  }
  return [...repeated];
};

export interface WinnerScoreConflict {
  matchId: MatchId;
  storedWinnerId: TeamId | null;
  scoreWinnerId: TeamId;
}

/**
 * Migration check: a saved match whose stored winner disagrees with its own
 * scores. Only comparable score pairs are checked, so legacy walkovers without
 * scores are not reported as conflicts.
 */
export const findWinnerScoreConflicts = (
  doc: GsdeTournamentDocument
): WinnerScoreConflict[] => {
  if (!doc.elimination) return [];
  const conflicts: WinnerScoreConflict[] = [];
  for (const match of listEliminationMatches(doc.elimination)) {
    if (match.status !== "completed" || !hasDecidableScores(match)) continue;
    const scoreWinnerId = deriveWinner(
      match.teamAId,
      match.teamBId,
      match.scoreA,
      match.scoreB
    );
    if (scoreWinnerId && match.winnerId !== scoreWinnerId) {
      conflicts.push({
        matchId: match.id,
        storedWinnerId: match.winnerId,
        scoreWinnerId,
      });
    }
  }
  return conflicts;
};

export class IntegrityError extends Error {
  readonly issues: IntegrityIssue[];

  constructor(issues: IntegrityIssue[]) {
    super(`Tournament integrity check failed: ${issues.map((issue) => issue.message).join("; ")}`);
    this.name = "IntegrityError";
    this.issues = issues;
  }
}

export const validateTournamentIntegrity = (
  doc: GsdeTournamentDocument
): IntegrityIssue[] => {
  const issues: IntegrityIssue[] = [];
  const add = (code: IntegrityCode, message: string) =>
    issues.push({ code, message });

  for (const id of duplicates(doc.teams.map((team) => team.id))) {
    add("duplicate-team-id", `Duplicate team id "${id}".`);
  }
  for (const id of duplicates(doc.groups.map((group) => group.id))) {
    add("duplicate-group-id", `Duplicate group id "${id}".`);
  }

  const registrations = doc.registrations ?? [];
  for (const uid of duplicates(registrations.map((item) => item.uid))) {
    add("duplicate-registration-uid", `Duplicate registration for account "${uid}".`);
  }
  for (const email of duplicates(
    registrations.map((item) => item.email.trim().toLowerCase())
  )) {
    add("duplicate-registration-email", `Duplicate registration for email "${email}".`);
  }
  const teamIds = new Set(doc.teams.map((team) => team.id));
  for (const registration of registrations) {
    if (
      registration.status === "approved" &&
      (!registration.teamId || !teamIds.has(registration.teamId))
    ) {
      add(
        "invalid-registration-team",
        `Approved registration "${registration.uid}" has no valid team.`
      );
    }
  }

  // Pairing invitations are a separate lifecycle from registrations and teams,
  // but they must still resolve to real players and never give one player two
  // simultaneous teams.
  const invitations = Object.values(doc.pairingInvitations ?? {});
  const registrationUids = new Set(registrations.map((item) => item.uid));
  const teamById = new Map(doc.teams.map((team) => [team.id, team]));
  const category = normalizeTournamentCategory(doc.tournament.config.category);
  const pairClaims = new Map<string, Set<string>>();
  const claim = (uid: string, teamId: string) => {
    const teams = pairClaims.get(uid) ?? new Set<string>();
    teams.add(teamId);
    pairClaims.set(uid, teams);
  };

  for (const invitation of invitations) {
    if (
      !invitation.id ||
      invitation.id !== invitation.inviterUid ||
      invitation.inviterUid === invitation.inviteeUid ||
      !registrationUids.has(invitation.inviterUid) ||
      !registrationUids.has(invitation.inviteeUid) ||
      invitation.category !== category ||
      !["pending", "accepted", "declined", "cancelled"].includes(
        invitation.status
      )
    ) {
      add(
        "invalid-pairing-invitation",
        `Pairing invitation "${invitation.id}" has invalid participants, status or category.`
      );
    }
    if (invitation.status === "accepted") {
      const team = invitation.teamId ? teamById.get(invitation.teamId) : undefined;
      if (
        !team ||
        team.playerIds.length !== 2 ||
        !team.playerIds.includes(invitation.inviterUid) ||
        !team.playerIds.includes(invitation.inviteeUid)
      ) {
        add(
          "invalid-pairing-team",
          `Accepted invitation "${invitation.id}" does not resolve to its two-player team.`
        );
      } else {
        claim(invitation.inviterUid, team.id);
        claim(invitation.inviteeUid, team.id);
      }
    } else if (invitation.teamId !== null) {
      add(
        "invalid-pairing-invitation",
        `Non-accepted invitation "${invitation.id}" must not carry a team id.`
      );
    }
  }

  for (const [uid, response] of Object.entries(doc.pairingResponses ?? {})) {
    const invitation = doc.pairingInvitations?.[response.invitationId];
    if (
      !uid ||
      !response.invitationId ||
      response.invitationId === uid ||
      !invitation ||
      invitation.inviteeUid !== uid ||
      !registrationUids.has(uid) ||
      (response.status !== "accepted" && response.status !== "declined") ||
      response.teamId !== invitation.teamId
    ) {
      add(
        "invalid-pairing-response",
        `Pairing response for "${response.invitationId}" is invalid.`
      );
    }
  }

  for (const team of doc.teams) {
    for (const uid of team.playerIds) claim(uid, team.id);
  }
  for (const [uid, teams] of pairClaims) {
    if (teams.size > 1) {
      add(
        "duplicate-player-pairing",
        `Player "${uid}" belongs to more than one team or accepted pairing.`
      );
    }
  }

  const groupIds = new Set(doc.groups.map((group) => group.id));
  const eliminationMatches = doc.elimination
    ? listEliminationMatches(doc.elimination)
    : [];

  for (const id of duplicates(doc.matches.map((match) => match.id))) {
    add("duplicate-group-match-id", `Duplicate group match id "${id}".`);
  }
  for (const id of duplicates(eliminationMatches.map((match) => match.id))) {
    add("duplicate-elimination-match-id", `Duplicate elimination match id "${id}".`);
  }
  const groupMatchIds = new Set(doc.matches.map((match) => match.id));
  for (const match of eliminationMatches) {
    if (groupMatchIds.has(match.id)) {
      add("overlapping-match-id", `Match id "${match.id}" used in both stages.`);
    }
  }

  for (const team of doc.teams) {
    if (team.playerIds.length > 2) {
      add(
        "invalid-team-size",
        `Team "${team.name}" has ${team.playerIds.length} players; a 2x2 pair needs exactly two.`
      );
    }
  }
  for (const message of validateTeamsForCategory(doc)) {
    add("invalid-team-category", message);
  }

  const expectedGroupSize = doc.tournament.config.teamsPerGroup ?? 4;
  for (const group of doc.groups) {
    if (group.teamIds.length !== expectedGroupSize) {
      add(
        "invalid-group-size",
        `Group "${group.id}" does not have ${expectedGroupSize} teams.`
      );
    }
    if (duplicates(group.teamIds).length > 0) {
      add("invalid-group-size", `Group "${group.id}" has duplicate teams.`);
    }
  }

  for (const match of doc.matches) {
    if (!groupIds.has(match.groupId)) {
      add("invalid-group-participants", `Match "${match.id}" has unknown group.`);
    }
    if (!match.teamAId || !match.teamBId || match.teamAId === match.teamBId) {
      add("invalid-group-participants", `Match "${match.id}" has invalid participants.`);
    }
    if (match.status === "completed" && !isGroupStageMatchComplete(match)) {
      add("incomplete-group-match", `Completed match "${match.id}" is missing result data.`);
    }
  }

  const seeds = doc.elimination?.seededTeamIds ?? [];
  const expectedSeedCount =
    doc.teams.length > 0 ? doc.teams.length : doc.tournament.config.teamLimit || 16;
  if (
    doc.elimination &&
    (seeds.length !== expectedSeedCount || duplicates(seeds).length > 0)
  ) {
    add(
      "invalid-seed-count",
      `Elimination bracket must have ${expectedSeedCount} unique seeds.`
    );
  }

  const eliminationIds = new Set(eliminationMatches.map((match) => match.id));
  for (const match of eliminationMatches) {
    const winner = getWinner(match);
    const loser = getLoser(match);
    // Scores are authoritative when present. Legacy records without scores
    // still need a valid stored winner/loser pair to be considered complete.
    const legacyResult = match.status === "completed" && !hasDecidableScores(match);
    if (
      match.status === "completed" &&
      (!winner ||
        !loser ||
        winner === loser ||
        ![match.teamAId, match.teamBId].includes(winner) ||
        ![match.teamAId, match.teamBId].includes(loser) ||
        (legacyResult && (!match.winnerId || !match.loserId)))
    ) {
      add(
        "invalid-elimination-result",
        `Completed elimination match "${match.id}" has invalid winner/loser.`
      );
    }
    for (const link of [match.winnerTo, match.loserTo]) {
      if (link && !eliminationIds.has(link.matchId)) {
        add(
          "broken-progression-link",
          `Match "${match.id}" links to unknown match "${link.matchId}".`
        );
      }
    }
  }

  for (const conflict of findWinnerScoreConflicts(doc)) {
    add(
      "winner-score-mismatch",
      `Elimination match "${conflict.matchId}" has a stored winner (${conflict.storedWinnerId ?? "none"}) that contradicts its scores; the score winner is ${conflict.scoreWinnerId}. Recompute the bracket from results to repair it.`
    );
  }

  return issues;
};

/** Throw on any integrity issue; used after every scored transition. */
export const assertTournamentIntegrity = (
  doc: GsdeTournamentDocument
): void => {
  const issues = validateTournamentIntegrity(doc);
  if (issues.length > 0) throw new IntegrityError(issues);
};
