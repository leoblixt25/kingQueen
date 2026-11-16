import type {
  EliminationBracket,
  MatchId,
  TeamId,
} from "./types";
import { notImplemented } from "./notImplemented";

/**
 * Elimination progression contract.
 *
 * Applies one completed elimination match: routes the winner forward, sends
 * the loser to the Losers Bracket or out of the tournament, and decides
 * whether the Grand Final needs a reset match.
 */
export interface EliminationMatchOutcome {
  matchId: MatchId;
  winnerId: TeamId;
  loserId: TeamId;
}

export interface EliminationAdvanceResult {
  bracket: EliminationBracket;
  /** Set when the loss is the team's second elimination-stage loss. */
  eliminatedTeamId: TeamId | null;
  /** Set when the Losers champion wins the first Grand Final. */
  resetFinalRequired: boolean;
}

export const advanceEliminationMatch = (
  _bracket: EliminationBracket,
  _outcome: EliminationMatchOutcome
): EliminationAdvanceResult => notImplemented("Elimination progression");

export const needsGrandFinalReset = (
  _bracket: EliminationBracket
): boolean => notImplemented("Grand Final reset check");
