import type { GsdeTournamentDocument } from "./persistence";
import type {
  MatchId,
  PlayerId,
  ScoreSubmission,
  ScoreSubmissionMap,
  TeamId,
} from "./types";
import { findRegistrationByUid, getRegisteredTeamId } from "./registration";
import { listEliminationMatches } from "./bracket";
import { getGameLabel, getGameNumber } from "./gameNumbers";
import type { AuditActor } from "./audit";
import { scoreEliminationMatch, scoreGroupMatch } from "./scoring";

/**
 * Player score submission for the isolated Group Stage + Double Elimination
 * format. This is the ONLY production path that lets a non-admin write a score.
 *
 * Rules enforced here (all pure, all inside `tournaments/{id}`):
 *  - the signed-in account must have an APPROVED registration with a team;
 *  - the match must be one their team actually plays, with a known opponent;
 *  - a match may be submitted once — a stored submission is immutable here;
 *  - scores are non-negative, non-tied integers;
 *  - the existing scoring service (and its integrity gate) performs the write.
 *
 * Admins keep their own input/edit path in `scoring.ts` (`scoreGroupMatch`,
 * `correctGroupMatchScore`, `scoreEliminationMatch`, `correctEliminationResult`).
 * Player submissions are audited with `isAdmin: false`; admin corrections stay
 * audited as corrections and are visible in the admin audit section.
 */

export type PlayerSubmissionErrorCode =
  | "not-registered"
  | "registration-not-approved"
  | "not-your-match"
  | "already-submitted"
  | "match-completed"
  | "invalid-score"
  | "unknown-match"
  | "bracket-not-generated";

export class PlayerSubmissionError extends Error {
  readonly code: PlayerSubmissionErrorCode;

  constructor(code: PlayerSubmissionErrorCode, message: string) {
    super(message);
    this.name = "PlayerSubmissionError";
    this.code = code;
  }
}

const fail = (code: PlayerSubmissionErrorCode, message: string): never => {
  throw new PlayerSubmissionError(code, message);
};

export interface PlayerScoreInput {
  /** Firebase Auth uid of the submitting player. */
  uid: PlayerId;
  matchId: MatchId;
  /** Score from the submitting player's team's point of view. */
  scoreFor: number;
  scoreAgainst: number;
}

export interface SubmittableMatch {
  matchId: MatchId;
  stage: "group" | "elimination";
  opponentId: TeamId | null;
  round: number;
  gameLabel: string;
  /** True when the player's team occupies teamA (scoreA) in the stored match. */
  isA: boolean;
}

export const getScoreSubmissions = (
  doc: GsdeTournamentDocument
): ScoreSubmissionMap => doc.scoreSubmissions ?? {};

/** The first submission for a match, regardless of which player submitted it. */
export const findSubmissionForMatch = (
  doc: GsdeTournamentDocument,
  matchId: MatchId
): ScoreSubmission | undefined => {
  for (const byMatch of Object.values(getScoreSubmissions(doc))) {
    if (byMatch[matchId]) return byMatch[matchId];
  }
  return undefined;
};

/** The submission a specific player made for a match (for UI display). */
export const findPlayerSubmission = (
  doc: GsdeTournamentDocument,
  uid: PlayerId,
  matchId: MatchId
): ScoreSubmission | undefined => getScoreSubmissions(doc)[uid]?.[matchId];

/**
 * Matches an approved player may still score: their own team, opponent known,
 * not completed and no submission recorded yet. Group and elimination matches
 * are listed separately and never mixed into one ranking system.
 */
export const listPlayerSubmittableMatches = (
  doc: GsdeTournamentDocument,
  teamId: TeamId
): SubmittableMatch[] => {
  const result: SubmittableMatch[] = [];

  for (const match of doc.matches) {
    if (match.teamAId !== teamId && match.teamBId !== teamId) continue;
    if (match.status === "completed") continue;
    if (findSubmissionForMatch(doc, match.id)) continue;
    result.push({
      matchId: match.id,
      stage: "group",
      opponentId: match.teamAId === teamId ? match.teamBId : match.teamAId,
      round: match.round,
      gameLabel: `Round ${match.round}`,
      isA: match.teamAId === teamId,
    });
  }

  if (doc.elimination) {
    for (const match of listEliminationMatches(doc.elimination)) {
      if (!match.teamAId || !match.teamBId) continue;
      if (match.teamAId !== teamId && match.teamBId !== teamId) continue;
      if (match.status === "completed") continue;
      if (findSubmissionForMatch(doc, match.id)) continue;
      const gameNumber = getGameNumber(match.id);
      result.push({
        matchId: match.id,
        stage: "elimination",
        opponentId: match.teamAId === teamId ? match.teamBId : match.teamAId,
        round: match.round,
        gameLabel: gameNumber === null ? match.id : getGameLabel(match.id),
        isA: match.teamAId === teamId,
      });
    }
  }

  return result.sort(
    (a, b) =>
      a.stage.localeCompare(b.stage) ||
      a.round - b.round ||
      a.matchId.localeCompare(b.matchId)
  );
};

const requireApprovedPlayer = (
  doc: GsdeTournamentDocument,
  uid: PlayerId
): { teamId: TeamId; label: string } => {
  const registration = findRegistrationByUid(doc, uid);
  if (!registration) {
    fail("not-registered", "You are not registered for this tournament.");
  }
  // Pairing creates membership through `team.playerIds` and deliberately
  // leaves `registration.teamId` null. Use the same approval-gated, DB-derived
  // lookup as the player pages so paired players can submit scores too.
  const teamId = getRegisteredTeamId(doc, uid);
  if (registration.status !== "approved" || !teamId) {
    fail(
      "registration-not-approved",
      "Your registration is not approved yet, or you have not formed a team."
    );
  }
  if (!doc.teams.some((team) => team.id === teamId)) {
    fail("registration-not-approved", "Your assigned team no longer exists.");
  }
  return { teamId: teamId as TeamId, label: registration.email };
};

const assertNotSubmitted = (
  doc: GsdeTournamentDocument,
  matchId: MatchId
): void => {
  if (findSubmissionForMatch(doc, matchId)) {
    fail(
      "already-submitted",
      "This score was already submitted. Only an admin can correct it."
    );
  }
};

/** Convert the player's "me : opponent" numbers into the stored A/B order. */
const toRawScores = (
  isA: boolean,
  scoreFor: number,
  scoreAgainst: number
): { scoreA: number; scoreB: number } => {
  if (
    !Number.isInteger(scoreFor) ||
    !Number.isInteger(scoreAgainst) ||
    scoreFor < 0 ||
    scoreAgainst < 0
  ) {
    fail("invalid-score", "Enter whole, non-negative scores for both teams.");
  }
  if (scoreFor === scoreAgainst) {
    fail("invalid-score", "Scores cannot be tied.");
  }
  return isA
    ? { scoreA: scoreFor, scoreB: scoreAgainst }
    : { scoreA: scoreAgainst, scoreB: scoreFor };
};

const withSubmission = (
  doc: GsdeTournamentDocument,
  submission: ScoreSubmission
): GsdeTournamentDocument => {
  const existing = getScoreSubmissions(doc);
  const byPlayer = existing[submission.playerUid] ?? {};
  return {
    ...doc,
    scoreSubmissions: {
      ...existing,
      [submission.playerUid]: {
        ...byPlayer,
        [submission.matchId]: submission,
      },
    },
  };
};

/** Submit a group-stage score for a match the player's team plays. */
export const submitPlayerGroupScore = (
  doc: GsdeTournamentDocument,
  input: PlayerScoreInput
): GsdeTournamentDocument => {
  const { teamId, label } = requireApprovedPlayer(doc, input.uid);
  const match = doc.matches.find((item) => item.id === input.matchId);
  if (!match) fail("unknown-match", `No group match "${input.matchId}".`);
  const isA = match.teamAId === teamId;
  if (!isA && match.teamBId !== teamId) {
    fail("not-your-match", "Your team is not playing in this match.");
  }
  assertNotSubmitted(doc, input.matchId);
  if (match.status === "completed") {
    fail("match-completed", "This match already has a result.");
  }

  const { scoreA, scoreB } = toRawScores(isA, input.scoreFor, input.scoreAgainst);
  const actor: AuditActor = { id: input.uid, label, isAdmin: false };
  const scored = scoreGroupMatch(doc, input.matchId, scoreA, scoreB, actor);
  return withSubmission(scored, {
    matchId: input.matchId,
    stage: "group",
    playerUid: input.uid,
    playerLabel: label,
    submittedAt: new Date().toISOString(),
    scoreA,
    scoreB,
    winnerId: scoreA > scoreB ? match.teamAId : match.teamBId,
  });
};

/** Submit an elimination score; winner/loser are derived from the score. */
export const submitPlayerEliminationScore = (
  doc: GsdeTournamentDocument,
  input: PlayerScoreInput
): GsdeTournamentDocument => {
  const { teamId, label } = requireApprovedPlayer(doc, input.uid);
  if (!doc.elimination) {
    fail("bracket-not-generated", "The elimination bracket has not been generated.");
  }
  const match =
    listEliminationMatches(doc.elimination).find(
      (item) => item.id === input.matchId
    ) ?? null;
  if (!match) fail("unknown-match", `No elimination match "${input.matchId}".`);
  if (!match.teamAId || !match.teamBId) {
    fail("not-your-match", "The opponent is not decided yet.");
  }
  const isA = match.teamAId === teamId;
  if (!isA && match.teamBId !== teamId) {
    fail("not-your-match", "Your team is not playing in this match.");
  }
  assertNotSubmitted(doc, input.matchId);
  if (match.status === "completed") {
    fail("match-completed", "This match already has a result.");
  }

  const { scoreA, scoreB } = toRawScores(isA, input.scoreFor, input.scoreAgainst);
  const winnerId = scoreA > scoreB ? match.teamAId : match.teamBId;
  const loserId = scoreA > scoreB ? match.teamBId : match.teamAId;
  const actor: AuditActor = { id: input.uid, label, isAdmin: false };
  const scored = scoreEliminationMatch(
    doc,
    { matchId: input.matchId, winnerId, loserId, scoreA, scoreB },
    actor
  );
  return withSubmission(scored, {
    matchId: input.matchId,
    stage: "elimination",
    playerUid: input.uid,
    playerLabel: label,
    submittedAt: new Date().toISOString(),
    scoreA,
    scoreB,
    winnerId,
  });
};
