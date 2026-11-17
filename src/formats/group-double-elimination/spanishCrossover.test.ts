import { describe, expect, it } from "vitest";
import type { EliminationBracket, EliminationMatch, TeamId } from "./types";
import {
  findEliminationMatch,
  generateDoubleEliminationBracket,
  replaceEliminationMatch,
  validateEliminationBracket,
} from "./bracket";
import {
  GAME_IDS_16,
  SPANISH_SEMIFINAL_SPECS,
  getGameIdByNumber,
  getGameLabel,
  getGameNumber,
} from "./gameNumbers";
import {
  applySpanishCrossover,
  hasSpanishCrossover,
  resolveSpanishSemifinalPairings,
} from "./spanishCrossover";
import { EliminationError } from "./errors";

const seeds = (): TeamId[] =>
  Array.from({ length: 16 }, (_, index) => `s${index + 1}`);

const bracket16 = (): EliminationBracket =>
  generateDoubleEliminationBracket(seeds()).bracket;

const completeSource = (
  bracket: EliminationBracket,
  matchId: string,
  winnerId: TeamId,
  loserId: TeamId
): EliminationBracket => {
  const match = findEliminationMatch(bracket, matchId);
  if (!match) throw new Error(`Missing ${matchId}`);

  return replaceEliminationMatch(bracket, {
    ...match,
    teamAId: winnerId,
    teamBId: loserId,
    status: "completed",
    winnerId,
    loserId,
  } as EliminationMatch);
};

describe("16-team game numbers", () => {
  it("maps Winners and Losers matches to the esports convention", () => {
    expect(getGameNumber("winners-r1-m1")).toBe(1);
    expect(getGameNumber("winners-r1-m8")).toBe(8);
    expect(getGameNumber("winners-r2-m4")).toBe(12);
    expect(getGameNumber("losers-r1-m4")).toBe(16);
    expect(getGameNumber("losers-r2-m4")).toBe(20);
    expect(getGameNumber("winners-r3-m1")).toBe(21);
    expect(getGameNumber("winners-r3-m2")).toBe(22);
    expect(getGameNumber("losers-r3-m1")).toBe(23);
    expect(getGameNumber("losers-r4-m2")).toBe(26);
    expect(getGameNumber("winners-r4-m1")).toBe(27);
    expect(getGameNumber("losers-r5-m1")).toBe(28);
    expect(getGameNumber("losers-r6-m1")).toBe(29);
    expect(getGameNumber("grand-final-1")).toBe(30);
    expect(getGameNumber("grand-final-2")).toBe(31);
    expect(getGameNumber("unknown")).toBeNull();
  });

  it("resolves game numbers back to ids", () => {
    expect(getGameIdByNumber(21)).toBe(GAME_IDS_16.game21);
    expect(getGameIdByNumber(25)).toBe(GAME_IDS_16.game25);
    expect(getGameIdByNumber(30)).toBe("grand-final-1");
    expect(getGameIdByNumber(99)).toBeNull();
    expect(getGameLabel("winners-r3-m1")).toBe("Game 21");
  });
});

describe("Spanish semifinal crossover", () => {
  it("defines the exact mandatory pairings", () => {
    expect(SPANISH_SEMIFINAL_SPECS).toEqual([
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
    ]);
  });

  it("is applied during fixed 16-team generation and stays valid", () => {
    const bracket = applySpanishCrossover(bracket16());

    expect(hasSpanishCrossover(bracket)).toBe(true);
    expect(validateEliminationBracket(bracket)).toEqual([]);
  });

  it("is idempotent", () => {
    const once = applySpanishCrossover(bracket16());
    const twice = applySpanishCrossover(once);

    expect(twice).toEqual(once);
  });

  it("rewires Winner Game 25 vs Winner Game 22 into Semi-final 1", () => {
    const bracket = applySpanishCrossover(bracket16());

    expect(findEliminationMatch(bracket, GAME_IDS_16.game25)?.winnerTo).toEqual({
      matchId: GAME_IDS_16.semiFinal1,
      slot: "teamA",
    });
    expect(findEliminationMatch(bracket, GAME_IDS_16.game22)?.winnerTo).toEqual({
      matchId: GAME_IDS_16.semiFinal1,
      slot: "teamB",
    });
  });

  it("rewires Winner Game 26 vs Winner Game 21 into Semi-final 2", () => {
    const bracket = applySpanishCrossover(bracket16());

    expect(findEliminationMatch(bracket, GAME_IDS_16.game26)?.winnerTo).toEqual({
      matchId: GAME_IDS_16.semiFinal2,
      slot: "teamA",
    });
    expect(findEliminationMatch(bracket, GAME_IDS_16.game21)?.winnerTo).toEqual({
      matchId: GAME_IDS_16.semiFinal2,
      slot: "teamB",
    });
  });

  it("does not use the rejected same-path pairings", () => {
    const bracket = applySpanishCrossover(bracket16());

    expect(findEliminationMatch(bracket, GAME_IDS_16.game21)?.winnerTo?.matchId).not.toBe(
      GAME_IDS_16.semiFinal1
    );
    expect(findEliminationMatch(bracket, GAME_IDS_16.game25)?.winnerTo?.matchId).not.toBe(
      GAME_IDS_16.semiFinal2
    );
  });

  it("resolves pairings only from completed source games", () => {
    const bracket = applySpanishCrossover(bracket16());

    expect(() => resolveSpanishSemifinalPairings(bracket)).toThrowError(
      EliminationError
    );

    let ready = completeSource(bracket, GAME_IDS_16.game25, "w25", "x25");
    ready = completeSource(ready, GAME_IDS_16.game22, "w22", "x22");
    ready = completeSource(ready, GAME_IDS_16.game26, "w26", "x26");
    ready = completeSource(ready, GAME_IDS_16.game21, "w21", "x21");

    expect(resolveSpanishSemifinalPairings(ready)).toEqual([
      {
        id: "semi-final-1",
        matchId: GAME_IDS_16.semiFinal1,
        teamAId: "w25",
        teamBId: "w22",
        sourceGameA: 25,
        sourceGameB: 22,
      },
      {
        id: "semi-final-2",
        matchId: GAME_IDS_16.semiFinal2,
        teamAId: "w26",
        teamBId: "w21",
        sourceGameA: 26,
        sourceGameB: 21,
      },
    ]);
  });

  it("leaves smaller brackets untouched", () => {
    const small = generateDoubleEliminationBracket(
      Array.from({ length: 8 }, (_, index) => `s${index + 1}`)
    ).bracket;

    expect(applySpanishCrossover(small)).toEqual(small);
    expect(hasSpanishCrossover(small)).toBe(false);
  });
});
