import type {
  BracketLink,
  EliminationBracket,
  EliminationMatch,
  MatchId,
  TeamId,
} from "./types";
import { getWinner } from "./matchResult";
import {
  findEliminationMatch,
  replaceEliminationMatch,
} from "./bracket";
import { EliminationError } from "./errors";
import {
  GAME_IDS_16,
  SPANISH_SEMIFINAL_SPECS,
  getGameIdByNumber,
  getGameNumber,
} from "./gameNumbers";

/**
 * Spanish 16-team semifinal crossover.
 *
 * A standard bracket plays Game 21 against Game 22 and Game 25 against Game 26
 * in the tail. The Spanish adaptation crosses those sources so that teams
 * that met in the last Winners round cannot meet again immediately:
 *
 *   Semi-final 1: Winner Game 25 vs Winner Game 22
 *   Semi-final 2: Winner Game 26 vs Winner Game 21
 *
 * This is implemented by rewiring the tail links:
 *   - the four source games feed the two semifinals;
 *   - both semifinal WINNERS go to the Grand Final (games 30/31);
 *   - both semifinal LOSERS go to the lower final (game 29) for 3rd/4th;
 *   - the lower final no longer feeds the Grand Final.
 *
 * The reset final is still added when the first Grand Final is won by a team
 * that was undefeated until then. Detection is based on elimination loss
 * counts, not on bracket slots, because the crossover mixes the slots.
 */

export interface SpanishPairing {
  id: "semi-final-1" | "semi-final-2";
  matchId: MatchId;
  teamAId: TeamId;
  teamBId: TeamId;
  sourceGameA: number;
  sourceGameB: number;
}

const requireMatch = (
  bracket: EliminationBracket,
  matchId: MatchId
): EliminationMatch => {
  const match = findEliminationMatch(bracket, matchId);
  if (!match) {
    throw new EliminationError(
      "invalid-bracket",
      `Spanish crossover needs match "${matchId}".`
    );
  }
  return match;
};

const setWinnerTo = (
  bracket: EliminationBracket,
  matchId: MatchId,
  link: BracketLink
): EliminationBracket => {
  const match = requireMatch(bracket, matchId);
  return replaceEliminationMatch(bracket, {
    ...match,
    winnerTo: link,
  });
};

const setLoserTo = (
  bracket: EliminationBracket,
  matchId: MatchId,
  link: BracketLink
): EliminationBracket => {
  const match = requireMatch(bracket, matchId);
  return replaceEliminationMatch(bracket, {
    ...match,
    loserTo: link,
  });
};

const clearWinnerTo = (
  bracket: EliminationBracket,
  matchId: MatchId
): EliminationBracket => {
  const match = requireMatch(bracket, matchId);
  return replaceEliminationMatch(bracket, {
    ...match,
    winnerTo: null,
  });
};

/**
 * Applies the crossover to a generated 16-team bracket.
 *
 * Safe to call more than once: it is an idempotent link rewrite. Brackets
 * with a different number of teams are returned untouched.
 */
export const applySpanishCrossover = (
  bracket: EliminationBracket
): EliminationBracket => {
  const semiFinal1 = findEliminationMatch(bracket, GAME_IDS_16.semiFinal1);
  const semiFinal2 = findEliminationMatch(bracket, GAME_IDS_16.semiFinal2);

  if (!semiFinal1 || !semiFinal2) return bracket;

  let next = bracket;
  next = setWinnerTo(next, GAME_IDS_16.game21, {
    matchId: GAME_IDS_16.semiFinal2,
    slot: "teamB",
  });
  next = setWinnerTo(next, GAME_IDS_16.game22, {
    matchId: GAME_IDS_16.semiFinal1,
    slot: "teamB",
  });
  next = setWinnerTo(next, GAME_IDS_16.game25, {
    matchId: GAME_IDS_16.semiFinal1,
    slot: "teamA",
  });
  next = setWinnerTo(next, GAME_IDS_16.game26, {
    matchId: GAME_IDS_16.semiFinal2,
    slot: "teamA",
  });

  // Tail: the semifinal winners meet in the Grand Final, and the semifinal
  // losers meet in the lower final for 3rd/4th place.
  next = setWinnerTo(next, GAME_IDS_16.semiFinal1, {
    matchId: GAME_IDS_16.grandFinal,
    slot: "teamA",
  });
  next = setLoserTo(next, GAME_IDS_16.semiFinal1, {
    matchId: GAME_IDS_16.lowerFinal,
    slot: "teamB",
  });
  next = setWinnerTo(next, GAME_IDS_16.semiFinal2, {
    matchId: GAME_IDS_16.grandFinal,
    slot: "teamB",
  });
  next = setLoserTo(next, GAME_IDS_16.semiFinal2, {
    matchId: GAME_IDS_16.lowerFinal,
    slot: "teamA",
  });
  // The lower final is now a 3rd-place match: its winner must not re-enter
  // the Grand Final, whose second slot is filled by Semi-final 2.
  next = clearWinnerTo(next, GAME_IDS_16.lowerFinal);

  return next;
};

/**
 * True when the bracket is wired to the mandatory crossover. Used by the
 * generation guard and by tests so a same-path pairing can never be shipped.
 */
export const hasSpanishCrossover = (
  bracket: EliminationBracket
): boolean => {
  type ExpectedWinner = [MatchId, BracketLink];
  type ExpectedLoser = [MatchId, BracketLink];

  const winnerLinks: readonly ExpectedWinner[] = [
    [
      GAME_IDS_16.game21,
      { matchId: GAME_IDS_16.semiFinal2, slot: "teamB" },
    ],
    [
      GAME_IDS_16.game22,
      { matchId: GAME_IDS_16.semiFinal1, slot: "teamB" },
    ],
    [
      GAME_IDS_16.game25,
      { matchId: GAME_IDS_16.semiFinal1, slot: "teamA" },
    ],
    [
      GAME_IDS_16.game26,
      { matchId: GAME_IDS_16.semiFinal2, slot: "teamA" },
    ],
    [
      GAME_IDS_16.semiFinal1,
      { matchId: GAME_IDS_16.grandFinal, slot: "teamA" },
    ],
    [
      GAME_IDS_16.semiFinal2,
      { matchId: GAME_IDS_16.grandFinal, slot: "teamB" },
    ],
  ];

  const loserLinks: readonly ExpectedLoser[] = [
    [
      GAME_IDS_16.semiFinal1,
      { matchId: GAME_IDS_16.lowerFinal, slot: "teamB" },
    ],
    [
      GAME_IDS_16.semiFinal2,
      { matchId: GAME_IDS_16.lowerFinal, slot: "teamA" },
    ],
  ];

  const matchesLink = (
    matchId: MatchId,
    field: "winnerTo" | "loserTo",
    link: BracketLink
  ): boolean => {
    const match = findEliminationMatch(bracket, matchId);
    const actual = match?.[field];
    return (
      actual?.matchId === link.matchId && actual.slot === link.slot
    );
  };

  return (
    winnerLinks.every(([matchId, link]) =>
      matchesLink(matchId, "winnerTo", link)
    ) &&
    loserLinks.every(([matchId, link]) =>
      matchesLink(matchId, "loserTo", link)
    ) &&
    findEliminationMatch(bracket, GAME_IDS_16.lowerFinal)?.winnerTo === null
  );
};

/**
 * Resolves the two semifinal pairings from completed source games.
 *
 * Throws until all of Games 21, 22, 25 and 26 have a winner, which prevents
 * progression from an incomplete result.
 */
export const resolveSpanishSemifinalPairings = (
  bracket: EliminationBracket
): SpanishPairing[] =>
  SPANISH_SEMIFINAL_SPECS.map((spec) => {
    const firstId = getGameIdByNumber(spec.firstSourceGame);
    const secondId = getGameIdByNumber(spec.secondSourceGame);

    if (!firstId || !secondId) {
      throw new EliminationError(
        "invalid-bracket",
        `Cannot resolve semifinal "${spec.id}" source games.`
      );
    }

    const first = requireMatch(bracket, firstId);
    const second = requireMatch(bracket, secondId);

    const firstWinner = getWinner(first);
    const secondWinner = getWinner(second);
    if (!firstWinner || !secondWinner) {
      throw new EliminationError(
        "invalid-outcome",
        `Semifinal "${spec.id}" needs the winners of Game ${spec.firstSourceGame} and Game ${spec.secondSourceGame}.`
      );
    }

    return {
      id: spec.id,
      matchId: spec.matchId,
      teamAId: firstWinner,
      teamBId: secondWinner,
      sourceGameA: spec.firstSourceGame,
      sourceGameB: spec.secondSourceGame,
    };
  });

/** Game numbers are attached to the fixed 16-team tail only. */
export const gameNumberForEliminationMatch = (
  matchId: MatchId
): number | null => getGameNumber(matchId);
