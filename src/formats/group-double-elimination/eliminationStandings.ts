import type { EliminationBracket, MatchId, TeamId } from "./types";
import { notImplemented } from "./notImplemented";

/**
 * Elimination standings contract.
 *
 * Only results from the elimination stage count here. Losses suffered in the
 * group stage are ignored by design.
 */
export type EliminationStatus =
  | "winners"
  | "losers"
  | "eliminated"
  | "champion";

export interface EliminationStanding {
  /** `null` while the team is still alive and its final place is unknown. */
  rank: number | null;
  teamId: TeamId;
  wins: number;
  losses: number;
  status: EliminationStatus;
  eliminatedByMatchId: MatchId | null;
}

export const calculateEliminationStandings = (
  _bracket: EliminationBracket
): EliminationStanding[] =>
  notImplemented("Elimination standings calculation");
