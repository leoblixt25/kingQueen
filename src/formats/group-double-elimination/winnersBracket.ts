import type { EliminationBracket, EliminationMatch, TeamId } from "./types";
import { getWinner } from "./matchResult";
import { GRAND_FINAL_ONE_ID } from "./bracket";

/**
 * Winners Bracket view helpers.
 *
 * The bracket itself is owned by `bracket.ts`; this module only projects it
 * for UI and progression code.
 */
export interface WinnersBracketRound {
  round: number;
  matches: EliminationMatch[];
}

export const getWinnersBracketRounds = (
  bracket: EliminationBracket
): WinnersBracketRound[] => {
  const rounds = new Map<number, EliminationMatch[]>();

  for (const match of bracket.winners) {
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

/**
 * Winner of the Winners Bracket (not the tournament champion).
 * Once the Winners final is played this is the team that reached the Grand
 * Final through the undefeated side.
 */
export const getWinnersChampion = (
  bracket: EliminationBracket
): TeamId | null => {
  const final = bracket.winners.find(
    (match) =>
      match.winnerTo?.matchId === GRAND_FINAL_ONE_ID &&
      match.winnerTo.slot === "teamA"
  );

  const roundOne = bracket.grandFinal.find((match) => match.round === 1);

  if (final?.status === "completed") {
    return getWinner(final);
  }

  // The slot can already be filled when the Winners final was itself a
  // collapsed bye, in which case no real final match exists.
  return roundOne?.teamAId ?? null;
};
