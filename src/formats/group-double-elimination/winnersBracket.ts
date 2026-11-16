import type { EliminationBracket, EliminationMatch, TeamId } from "./types";
import { notImplemented } from "./notImplemented";

/**
 * Winners Bracket view contract.
 *
 * The bracket itself is owned by `bracket.ts`; this module exposes the
 * Winners Bracket rounds and champion for UI and progression code.
 */
export interface WinnersBracketRound {
  round: number;
  matches: EliminationMatch[];
}

export const getWinnersBracketRounds = (
  _bracket: EliminationBracket
): WinnersBracketRound[] => notImplemented("Winners Bracket projection");

export const getWinnersChampion = (
  _bracket: EliminationBracket
): TeamId | null => notImplemented("Winners Bracket champion lookup");
