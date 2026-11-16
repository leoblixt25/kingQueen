import type { EliminationBracket, EliminationMatch, TeamId } from "./types";
import { notImplemented } from "./notImplemented";

/**
 * Losers Bracket view contract.
 *
 * Teams arrive here after their first elimination-stage loss. A loss in this
 * bracket is the team's second elimination loss and ends their tournament.
 */
export interface LosersBracketRound {
  round: number;
  matches: EliminationMatch[];
}

export const getLosersBracketRounds = (
  _bracket: EliminationBracket
): LosersBracketRound[] => notImplemented("Losers Bracket projection");

export const getLosersChampion = (
  _bracket: EliminationBracket
): TeamId | null => notImplemented("Losers Bracket champion lookup");
