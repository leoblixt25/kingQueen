import { describe, expect, it } from "vitest";
import type { EliminationBracket, TeamId } from "./types";
import {
  buildSeedOrder,
  generateDoubleEliminationBracket,
  nextBracketSize,
  validateEliminationBracket,
  winnerMatchId,
} from "./bracket";
import {
  getWinnersBracketRounds,
  getWinnersChampion,
} from "./winnersBracket";
import {
  getLosersBracketRounds,
  getLosersChampion,
} from "./losersBracket";
import {
  advanceEliminationMatch,
  isEliminationComplete,
} from "./progression";
import { EliminationError } from "./errors";

const seeds = (count: number): TeamId[] =>
  Array.from({ length: count }, (_, index) => `s${index + 1}`);

const captureError = (action: () => unknown): EliminationError => {
  try {
    action();
  } catch (error) {
    if (error instanceof EliminationError) return error;
    throw error;
  }
  throw new Error("Expected an EliminationError");
};

const ids = (matches: { id: string }[]): string[] => matches.map((m) => m.id);

describe("bracket size and seed order", () => {
  it("rounds up to the next power of two", () => {
    expect([2, 3, 4, 5, 8, 9].map(nextBracketSize)).toEqual([2, 4, 4, 8, 8, 16]);
  });

  it("uses the classic seed order", () => {
    expect(buildSeedOrder(2)).toEqual([1, 2]);
    expect(buildSeedOrder(4)).toEqual([1, 4, 2, 3]);
    expect(buildSeedOrder(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
  });
});

describe("8-team bracket", () => {
  const plan = generateDoubleEliminationBracket(seeds(8));
  const { bracket } = plan;

  it("builds both brackets and the Grand Final", () => {
    expect(bracket.bracketSize).toBe(8);
    expect(bracket.byeTeamIds).toEqual([]);
    expect(bracket.seededTeamIds).toEqual(seeds(8));
    expect(bracket.winners).toHaveLength(7);
    expect(bracket.losers).toHaveLength(6);
    expect(bracket.grandFinal).toHaveLength(1);
    expect(bracket.resetFinalRequired).toBe(false);
  });

  it("pairs the seeds through the bracket order", () => {
    const roundOne = bracket.winners.filter((match) => match.round === 1);

    expect(roundOne.map((match) => [match.teamAId, match.teamBId])).toEqual([
      ["s1", "s8"],
      ["s4", "s5"],
      ["s2", "s7"],
      ["s3", "s6"],
    ]);
    expect(roundOne.every((match) => match.status === "ready")).toBe(true);
    expect(
      bracket.winners
        .filter((match) => match.round > 1)
        .every((match) => match.status === "pending")
    ).toBe(true);
  });

  it("routes winners forward and losers into the Losers Bracket", () => {
    const first = bracket.winners[0];
    const second = bracket.winners[1];
    const losersFirst = bracket.losers.find((m) => m.id === "losers-r1-m1");

    expect(first.winnerTo).toEqual({ matchId: winnerMatchId(2, 1), slot: "teamA" });
    expect(second.winnerTo).toEqual({ matchId: winnerMatchId(2, 1), slot: "teamB" });
    expect(first.loserTo).toEqual({ matchId: losersFirst?.id, slot: "teamA" });
    expect(second.loserTo).toEqual({ matchId: losersFirst?.id, slot: "teamB" });

    const winnersFinal = bracket.winners.find(
      (match) => match.id === winnerMatchId(3, 1)
    );
    expect(winnersFinal?.winnerTo).toEqual({
      matchId: "grand-final-1",
      slot: "teamA",
    });

    const losersFinal = bracket.losers[bracket.losers.length - 1];
    expect(losersFinal.winnerTo).toEqual({
      matchId: "grand-final-1",
      slot: "teamB",
    });
    expect(losersFinal.loserTo).toBeNull();
  });

  it("creates deterministic, unique ids for every match", () => {
    const again = generateDoubleEliminationBracket(seeds(8));

    expect(again).toEqual(plan);
    const all = [
      ...bracket.winners,
      ...bracket.losers,
      ...bracket.grandFinal,
    ];
    expect(new Set(ids(all)).size).toBe(all.length);
    expect(
      all.every(
        (match) =>
          /^winners-r\d+-m\d+$/.test(match.id) ||
          /^losers-r\d+-m\d+$/.test(match.id) ||
          /^grand-final-[12]$/.test(match.id)
      )
    ).toBe(true);
  });

  it("passes its own validation", () => {
    expect(validateEliminationBracket(bracket)).toEqual([]);
  });
});

describe("byes and uneven team counts", () => {
  it("gives a bye to the top seed with 3 teams", () => {
    const { bracket } = generateDoubleEliminationBracket(seeds(3));

    expect(bracket.bracketSize).toBe(4);
    expect(bracket.byeTeamIds).toEqual(["s1"]);
    expect(bracket.winners).toHaveLength(2);
    expect(bracket.losers).toHaveLength(1);
    expect(bracket.grandFinal).toHaveLength(1);
    expect(validateEliminationBracket(bracket)).toEqual([]);
  });

  it("gives byes to the top three seeds with 5 teams", () => {
    const { bracket } = generateDoubleEliminationBracket(seeds(5));

    expect(bracket.bracketSize).toBe(8);
    expect(bracket.byeTeamIds).toEqual(["s1", "s2", "s3"]);
    expect(ids(bracket.winners.filter((m) => m.round === 1))).toEqual([
      "winners-r1-m2",
    ]);
    expect(ids(bracket.losers)).toEqual([
      "losers-r2-m1",
      "losers-r3-m1",
      "losers-r4-m1",
    ]);
    expect(validateEliminationBracket(bracket)).toEqual([]);
  });

  it("gives byes to the top two seeds with 6 teams", () => {
    const { bracket } = generateDoubleEliminationBracket(seeds(6));

    expect(bracket.byeTeamIds).toEqual(["s1", "s2"]);
    expect(bracket.winners.filter((m) => m.round === 1)).toHaveLength(2);
    expect(validateEliminationBracket(bracket)).toEqual([]);
  });

  it("gives a bye only to the top seed with 7 teams", () => {
    const { bracket } = generateDoubleEliminationBracket(seeds(7));

    expect(bracket.byeTeamIds).toEqual(["s1"]);
    expect(bracket.winners.filter((m) => m.round === 1)).toHaveLength(3);
    expect(validateEliminationBracket(bracket)).toEqual([]);
  });

  it("runs a two-team bracket straight to the Grand Final", () => {
    const { bracket } = generateDoubleEliminationBracket(seeds(2));

    expect(bracket.winners).toHaveLength(1);
    expect(bracket.losers).toHaveLength(0);
    expect(bracket.byeTeamIds).toEqual([]);
    expect(bracket.grandFinal[0]).toMatchObject({
      teamAId: null,
      teamBId: null,
      status: "pending",
    });
    expect(validateEliminationBracket(bracket)).toEqual([]);
  });

  it("never schedules a team twice in the same winners round", () => {
    for (const count of [2, 3, 5, 6, 7, 8, 9, 12]) {
      const { bracket } = generateDoubleEliminationBracket(seeds(count));
      const byRound = new Map<number, TeamId[]>();

      for (const match of bracket.winners) {
        const teams = byRound.get(match.round) ?? [];
        if (match.teamAId) teams.push(match.teamAId);
        if (match.teamBId) teams.push(match.teamBId);
        byRound.set(match.round, teams);
      }

      for (const teams of byRound.values()) {
        expect(new Set(teams).size).toBe(teams.length);
      }
    }
  });
});

describe("bracket generation errors", () => {
  it("rejects fewer than two teams", () => {
    expect(captureError(() => generateDoubleEliminationBracket(seeds(1))).code).toBe(
      "invalid-team-count"
    );
  });

  it("rejects empty team ids", () => {
    expect(
      captureError(() => generateDoubleEliminationBracket(["s1", "  "])).code
    ).toBe("invalid-team-count");
  });

  it("rejects duplicate teams", () => {
    expect(
      captureError(() => generateDoubleEliminationBracket(["s1", "s2", "s1"])).code
    ).toBe("duplicate-team");
  });
});

describe("bracket views", () => {
  const playAll = (bracket: EliminationBracket): EliminationBracket => {
    let state = bracket;

    while (!isEliminationComplete(state)) {
      const next = [...state.winners, ...state.losers, ...state.grandFinal].find(
        (match) => match.status === "ready"
      );
      if (!next) throw new Error("No ready match.");
      state = advanceEliminationMatch(state, {
        matchId: next.id,
        winnerId: next.teamAId as TeamId,
        loserId: next.teamBId as TeamId,
      }).bracket;
    }

    return state;
  };

  it("groups the winners and losers rounds in order", () => {
    const { bracket } = generateDoubleEliminationBracket(seeds(8));

    expect(
      getWinnersBracketRounds(bracket).map((round) => [
        round.round,
        round.matches.length,
      ])
    ).toEqual([
      [1, 4],
      [2, 2],
      [3, 1],
    ]);
    expect(
      getLosersBracketRounds(bracket).map((round) => [
        round.round,
        round.matches.length,
      ])
    ).toEqual([
      [1, 2],
      [2, 2],
      [3, 1],
      [4, 1],
    ]);
  });

  it("reports both bracket champions after the bracket is played", () => {
    const { bracket } = generateDoubleEliminationBracket(seeds(8));

    expect(getWinnersChampion(bracket)).toBeNull();
    expect(getLosersChampion(bracket)).toBeNull();

    const finished = playAll(bracket);
    expect(getWinnersChampion(finished)).toBe("s1");
    expect(getLosersChampion(finished)).toBe("s8");
  });

  it("finds the Losers champion in a two-team bracket", () => {
    const { bracket } = generateDoubleEliminationBracket(seeds(2));
    const state = advanceEliminationMatch(bracket, {
      matchId: "winners-r1-m1",
      winnerId: "s1",
      loserId: "s2",
    }).bracket;

    expect(getWinnersChampion(state)).toBe("s1");
    expect(getLosersChampion(state)).toBe("s2");
  });
});

describe("bracket validation", () => {
  const { bracket } = generateDoubleEliminationBracket(seeds(8));

  const clone = (patch: Partial<EliminationBracket>): EliminationBracket => ({
    ...bracket,
    ...patch,
  });

  it("reports duplicate ids", () => {
    const duplicate = clone({
      winners: [...bracket.winners, { ...bracket.winners[0] }],
    });

    expect(
      validateEliminationBracket(duplicate).some((problem) =>
        problem.includes("Duplicate match id")
      )
    ).toBe(true);
  });

  it("reports links to unknown matches", () => {
    const broken = clone({
      winners: bracket.winners.map((match) =>
        match.id === "winners-r1-m1"
          ? { ...match, winnerTo: { matchId: "missing", slot: "teamA" } }
          : match
      ),
    });

    expect(
      validateEliminationBracket(broken).some((problem) =>
        problem.includes("unknown match")
      )
    ).toBe(true);
  });

  it("reports a slot fed by two matches", () => {
    const broken = clone({
      winners: bracket.winners.map((match) =>
        match.id === "winners-r1-m2"
          ? { ...match, winnerTo: { matchId: "winners-r2-m1", slot: "teamA" } }
          : match
      ),
    });

    expect(
      validateEliminationBracket(broken).some((problem) =>
        problem.includes("is fed by both")
      )
    ).toBe(true);
  });

  it("reports a completed match with an unknown winner", () => {
    const broken = clone({
      winners: bracket.winners.map((match) =>
        match.id === "winners-r1-m1"
          ? {
              ...match,
              status: "completed",
              winnerId: "intruder",
              loserId: match.teamBId,
            }
          : match
      ),
    });

    expect(
      validateEliminationBracket(broken).some((problem) =>
        problem.includes("winner is not a participant")
      )
    ).toBe(true);
  });
});
