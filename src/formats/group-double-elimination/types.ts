/**
 * Domain model for the Group Stage + Double Elimination format.
 *
 * Types only — no generation, ranking or progression logic lives here.
 * Keeping the model separate from the algorithms lets the future engines be
 * tested as pure functions and prevents any coupling to King & Queen data.
 */

export type TeamId = string;
export type GroupId = string;
export type MatchId = string;
export type PlayerId = string;

export type GsdeTournamentStatus =
  | "draft"
  | "configured"
  | "group-stage"
  | "elimination"
  | "grand-final"
  | "completed";

export type MatchStatus = "pending" | "ready" | "completed";

/** Where a match sits in the elimination stage. */
export type BracketSide = "winners" | "losers" | "grand-final";

/** Which side of a match a team is fed into. */
export type BracketSlot = "teamA" | "teamB";

export interface BracketLink {
  matchId: MatchId;
  slot: BracketSlot;
}

export interface TournamentConfig {
  name: string;
  /** Tournament date as a plain `YYYY-MM-DD` string (empty until set). */
  date: string;
  /** Configured team limit. The fixed engine enforces exactly 16. */
  teamLimit: number;
  divisionName: string;
  groupCount: number;
  /** Single-set matches are the only supported format for now. */
  matchFormat: "single-set";
  /** Target team count per group; `null` lets group management decide. */
  teamsPerGroup: number | null;
  /** Format rule: nobody is eliminated in the group stage. */
  advanceAllTeams: true;
  /** Format rule: a reset final is required if the Losers champion wins GF1. */
  grandFinalReset: true;
}

export interface Team {
  id: TeamId;
  name: string;
  /** Optional link to the existing shared player identities. */
  playerIds: PlayerId[];
  seed: number | null;
  groupId: GroupId | null;
  /**
   * Admin approval state. Legacy documents without this field are treated as
   * approved (see `isApprovedTeam`), so older persisted tournaments keep working.
   */
  status?: "pending" | "approved";
}

/** Legacy-safe approval check: missing status means approved. */
export const isApprovedTeam = (team: Team): boolean =>
  team.status !== "pending";

/** Admin decision on a self-registered player. */
export type PlayerRegistrationStatus = "pending" | "approved" | "rejected";

/**
 * A player who signed up for THIS tournament themselves. Registrations live
 * only in the isolated `tournaments/{id}` document — never in the King & Queen
 * `players` collection. The auth `uid` is the authoritative identity; `email`
 * is kept for display and duplicate detection.
 */
export interface PlayerRegistration {
  /** Firebase Auth uid of the registering player. */
  uid: string;
  /** Lower-cased email of the registering player. */
  email: string;
  /** Display name entered at registration. */
  name: string;
  status: PlayerRegistrationStatus;
  /** Team assigned by an admin on approval; `null` until then. */
  teamId: TeamId | null;
  /** ISO timestamp of the registration. */
  registeredAt: string;
  /** ISO timestamp of the approval/rejection, or `null`. */
  decidedAt: string | null;
}

export interface Group {
  id: GroupId;
  name: string;
  teamIds: TeamId[];
}

export interface MatchScore {
  scoreA: number | null;
  scoreB: number | null;
}

export interface GroupStageMatch extends MatchScore {
  id: MatchId;
  phase: "group";
  groupId: GroupId;
  round: number;
  index: number;
  teamAId: TeamId;
  teamBId: TeamId;
  status: MatchStatus;
  winnerId: TeamId | null;
}

export interface EliminationMatch extends MatchScore {
  id: MatchId;
  phase: BracketSide;
  round: number;
  index: number;
  /** Elimination slots can be empty until the feeding match completes. */
  teamAId: TeamId | null;
  teamBId: TeamId | null;
  status: MatchStatus;
  winnerId: TeamId | null;
  loserId: TeamId | null;
  /** Where the winner advances; `null` for the final match of a bracket. */
  winnerTo: BracketLink | null;
  /** Where the loser drops; `null` means the team is eliminated. */
  loserTo: BracketLink | null;
}

/**
 * One authoritative record that a player has submitted a score for a match.
 * Stored inside `tournaments/{id}` (never in a separate collection) and keyed
 * by the submitting player's uid, then by match id. A record is immutable:
 * players submit once, and only an admin may correct the underlying score.
 */
export interface ScoreSubmission {
  matchId: MatchId;
  stage: "group" | "elimination";
  /** Firebase Auth uid of the submitting player. */
  playerUid: PlayerId;
  /** Email/name recorded for display in the audit trail. */
  playerLabel: string;
  submittedAt: string;
  /** Scores in the match's own A/B orientation. */
  scoreA: number;
  scoreB: number;
  /** Winning team derived from the submitted score. */
  winnerId: TeamId;
}

/** uid → (matchId → submission). Enables submit-once checks in Firestore rules. */
export type ScoreSubmissionMap = Record<PlayerId, Record<MatchId, ScoreSubmission>>;

export interface EliminationBracket {
  winners: EliminationMatch[];
  losers: EliminationMatch[];
  grandFinal: EliminationMatch[];
  /** Set once the Losers champion wins the first Grand Final. */
  resetFinalRequired: boolean;
  /** Seeds in bracket order, best first. Never contains group-stage records. */
  seededTeamIds?: TeamId[];
  /** Bracket size: the next power of two >= `seededTeamIds.length`. */
  bracketSize?: number;
  /** Teams that skip the first Winners round because of a bye. */
  byeTeamIds?: TeamId[];
}
