import type { EliminationBracket, TeamId } from "./types";
import { notImplemented } from "./notImplemented";

/**
 * Double-elimination bracket generation contract.
 *
 * Covers both brackets plus the Grand Final. Every team enters the Wins
 * Bracket with zero losses; a group-stage loss never becomes an elimination
 * loss.
 */
export interface EliminationBracketPlan {
  bracket: EliminationBracket;
  seededTeamIds: TeamId[];
}

export const generateDoubleEliminationBracket = (
  _seededTeamIds: readonly TeamId[]
): EliminationBracketPlan =>
  notImplemented("Double-elimination bracket generation");

export const validateEliminationBracket = (
  _bracket: EliminationBracket
): string[] => notImplemented("Elimination bracket validation");
