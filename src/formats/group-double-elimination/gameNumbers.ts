import type { MatchId } from "./types";
import {
  GRAND_FINAL_ONE_ID,
  GRAND_FINAL_TWO_ID,
  loserMatchId,
  winnerMatchId,
} from "./bracket";

/**
 * Stable presentation labels for the standard 16-team elimination bracket.
 *
 * The numbers follow the common esports convention:
 *
 *   1-8   Winners Round 1
 *   9-12  Winners Round 2
 *   13-16 Losers Round 1
 *   17-20 Losers Round 2
 *   21-22 Winners Round 3
 *   23-24 Losers Round 3
 *   25-26 Losers Round 4
 *   27    Winners Final
 *   28    Losers Round 5
 *   29    Losers Round 6 (lower final)
 *   30    Grand Final
 *   31    Reset Final (only when required)
 *
 * Game numbers are presentation metadata only. The operational engine always
 * routes with deterministic match ids; the legacy semifinal-crossover helpers
 * below are retained for compatibility and are not used to build brackets.
 */

export const GAME_IDS_16 = {
  game21: winnerMatchId(3, 1),
  game22: winnerMatchId(3, 2),
  game25: loserMatchId(4, 1),
  game26: loserMatchId(4, 2),
  semiFinal1: winnerMatchId(4, 1),
  semiFinal2: loserMatchId(5, 1),
  lowerFinal: loserMatchId(6, 1),
  grandFinal: GRAND_FINAL_ONE_ID,
  resetFinal: GRAND_FINAL_TWO_ID,
} as const;

export interface SpanishSemifinalSpec {
  id: "semi-final-1" | "semi-final-2";
  /** Game number where the first participant comes from. */
  firstSourceGame: number;
  /** Game number where the second participant comes from. */
  secondSourceGame: number;
  /** Match that hosts this semifinal. */
  matchId: MatchId;
}

/**
 * Legacy semifinal-crossover specification, retained only for the standalone
 * `spanishCrossover` utility and its tests. The operational fixed-16 bracket
 * uses the canonical winner/loser links from `bracket.ts` instead.
 */
export const SPANISH_SEMIFINAL_SPECS: readonly SpanishSemifinalSpec[] = [
  {
    id: "semi-final-1",
    firstSourceGame: 25,
    secondSourceGame: 22,
    matchId: GAME_IDS_16.semiFinal1,
  },
  {
    id: "semi-final-2",
    firstSourceGame: 26,
    secondSourceGame: 21,
    matchId: GAME_IDS_16.semiFinal2,
  },
];

const GAME_NUMBER_BY_ID: Readonly<Record<string, number>> = (() => {
  const map: Record<string, number> = {};

  for (let index = 1; index <= 8; index += 1) {
    map[winnerMatchId(1, index)] = index;
  }
  for (let index = 1; index <= 4; index += 1) {
    map[winnerMatchId(2, index)] = 8 + index;
    map[loserMatchId(1, index)] = 12 + index;
    map[loserMatchId(2, index)] = 16 + index;
  }
  for (let index = 1; index <= 2; index += 1) {
    map[winnerMatchId(3, index)] = 20 + index;
    map[loserMatchId(3, index)] = 22 + index;
    map[loserMatchId(4, index)] = 24 + index;
  }
  map[winnerMatchId(4, 1)] = 27;
  map[loserMatchId(5, 1)] = 28;
  map[loserMatchId(6, 1)] = 29;
  map[GRAND_FINAL_ONE_ID] = 30;
  map[GRAND_FINAL_TWO_ID] = 31;

  return map;
})();

/** Human-facing game number, or `null` for ids outside the 16-team bracket. */
export const getGameNumber = (matchId: MatchId): number | null =>
  GAME_NUMBER_BY_ID[matchId] ?? null;

/** Reverse lookup used by the semifinal crossover resolver. */
export const getGameIdByNumber = (gameNumber: number): MatchId | null => {
  const entry = Object.entries(GAME_NUMBER_BY_ID).find(
    ([, value]) => value === gameNumber
  );
  return entry?.[0] ?? null;
};

export const getGameLabel = (matchId: MatchId): string => {
  const number = getGameNumber(matchId);
  return number === null ? matchId : `Game ${number}`;
};

export const GAME_COUNT_16 = 30;
