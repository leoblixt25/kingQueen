import type { EliminationBracket, EliminationMatch, TeamId } from "./types";
import { GRAND_FINAL_ONE_ID } from "./bracket";

/**
 * Losers Bracket view helpers.
 *
 * Teams arrive here after their first elimination-stage loss. A loss in this
 * bracket is the team's second elimination loss and ends their tournament.
 */
export interface LosersBracketRound {
  round: number;
  matches: EliminationMatch[];
}

export const getLosersBracketRounds = (
  bracket: EliminationBracket
): LosersBracketRound[] => {
  const rounds = new Map<number, EliminationMatch[]>();

  for (const match of bracket.losers) {
    const block = rounds.get(match.round);
    if (block) {
      block.push(match);
    } else {
      rounds.set(match.round, [match]);
    }
  }

  return [...rounds.keys()]
    .sort((a, b) => a - b)
    .map((round) => ({
      round,
      matches: [...(rounds.get(round) ?? [])].sort(
        (a, b) => a.index - b.index
      ),
    }));
};

/** Winner of the Losers Bracket, i.e. the Grand Final challenger. */
export const getLosersChampion = (
  bracket: EliminationBracket
): TeamId | null => {
  const roundOne = bracket.grandFinal.find((match) => match.round === 1);

  const final = bracket.losers.find(
    (match) =>
      match.winnerTo?.matchId === GRAND_FINAL_ONE_ID &&
      match.winnerTo.slot === "teamB"
  );

  if (final?.status === "completed" && final.winnerId) {
    return final.winnerId;
  }

  // With two teams the Losers champion is the first-round loser, so no
  // Losers Bracket match exists to look at.
  return roundOne?.teamBId ?? null;
};
