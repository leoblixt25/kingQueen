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
