import { describe, expect, it } from "vitest";
import type { EliminationBracket, EliminationMatch, TeamId } from "./types";
import {
  generateDoubleEliminationBracket,
  listEliminationMatches,
} from "./bracket";
import { advanceEliminationMatch, isEliminationComplete } from "./progression";
import {
  calculateEliminationStandings,
  calculateFinalPlacements,
} from "./eliminationStandings";

const seeds = (count: number): TeamId[] =>
  Array.from({ length: count }, (_, index) => `s${index + 1}`);

const byId = (bracket: EliminationBracket, id: string) => {
  const match = listEliminationMatches(bracket).find((m) => m.id === id);
  if (!match) throw new Error(`Missing match ${id}`);
  return match;
};

const play = (
  bracket: EliminationBracket,
  match: EliminationMatch,
  winner: "teamA" | "teamB" = "teamA"
) =>
  advanceEliminationMatch(bracket, {
    matchId: match.id,
    winnerId:
      winner === "teamA"
        ? (match.teamAId as TeamId)
        : (match.teamBId as TeamId),
    loserId:
      winner === "teamA"
        ? (match.teamBId as TeamId)
        : (match.teamAId as TeamId),
  }).bracket;

const playAll = (bracket: EliminationBracket): EliminationBracket => {
  let state = bracket;

  while (!isEliminationComplete(state)) {
    const next = listEliminationMatches(state).find(
      (match) => match.status === "ready"
    );
    if (!next) throw new Error("No ready match.");
    state = play(state, next);
  }

  return state;
};

const rowFor = (bracket: EliminationBracket, teamId: TeamId) => {
  const row = calculateEliminationStandings(bracket).find(
    (standing) => standing.teamId === teamId
  );
  if (!row) throw new Error(`No standing for ${teamId}`);
  return row;
};

describe("elimination standings", () => {
  it("starts everyone at zero elimination losses", () => {
    const { bracket } = generateDoubleEliminationBracket(seeds(8));
    const standings = calculateEliminationStandings(bracket);

    expect(standings).toHaveLength(8);
    expect(
      standings.every(
        (row) =>
          row.wins === 0 &&
          row.losses === 0 &&
          row.rank === null &&
          row.status === "winners"
      )
    ).toBe(true);
  });

  it("marks a first loss as alive in the Losers Bracket", () => {
    const { bracket } = generateDoubleEliminationBracket(seeds(8));
    const state = play(bracket, byId(bracket, "winners-r1-m1"));

    expect(rowFor(state, "s8")).toMatchObject({
      wins: 0,
      losses: 1,
      status: "losers",
      rank: null,
      eliminatedByMatchId: null,
    });
    expect(rowFor(state, "s1")).toMatchObject({
      wins: 1,
      losses: 0,
      status: "winners",
      rank: null,
    });
  });

  it("marks the second loss as eliminated", () => {
    const { bracket } = generateDoubleEliminationBracket(seeds(8));
    let state = play(bracket, byId(bracket, "winners-r1-m1"));
    state = play(state, byId(state, "winners-r1-m2"));
    state = play(state, byId(state, "losers-r1-m1"));

    expect(rowFor(state, "s5")).toMatchObject({
      losses: 2,
      status: "eliminated",
      eliminatedByMatchId: "losers-r1-m1",
    });
  });

  it("ranks a completed tournament with ties", () => {
    const finished = playAll(generateDoubleEliminationBracket(seeds(8)).bracket);

    const expected: Record<string, [number | null, string]> = {
      s1: [1, "champion"],
      s8: [2, "eliminated"],
      s2: [3, "eliminated"],
      s7: [4, "eliminated"],
      s4: [5, "eliminated"],
      s3: [5, "eliminated"],
      s5: [7, "eliminated"],
      s6: [7, "eliminated"],
    };

    for (const [teamId, [rank, status]] of Object.entries(expected)) {
      expect(rowFor(finished, teamId)).toMatchObject({ rank, status });
    }
  });

  it("records the match that ended each team", () => {
    const finished = playAll(generateDoubleEliminationBracket(seeds(8)).bracket);

    expect(rowFor(finished, "s5").eliminatedByMatchId).toBe("losers-r1-m1");
    expect(rowFor(finished, "s4").eliminatedByMatchId).toBe("losers-r2-m1");
    expect(rowFor(finished, "s2").eliminatedByMatchId).toBe("losers-r4-m1");
    expect(rowFor(finished, "s8").eliminatedByMatchId).toBe("grand-final-1");
    expect(rowFor(finished, "s1").eliminatedByMatchId).toBeNull();
  });

  it("counts only elimination-stage results", () => {
    const finished = playAll(generateDoubleEliminationBracket(seeds(8)).bracket);
    const totalLosses = calculateEliminationStandings(finished).reduce(
      (sum, row) => sum + row.losses,
      0
    );
    const totalWins = calculateEliminationStandings(finished).reduce(
      (sum, row) => sum + row.wins,
      0
    );

    expect(totalWins).toBe(totalLosses);
    expect(totalLosses).toBe(14);
  });
});

describe("final placements", () => {
  it("projects places while the tournament is still running", () => {
    const { bracket } = generateDoubleEliminationBracket(seeds(8));
    let state = bracket;

    for (const id of [
      "winners-r1-m1",
      "winners-r1-m2",
      "winners-r1-m3",
      "winners-r1-m4",
      "losers-r1-m1",
      "losers-r1-m2",
    ]) {
      state = play(state, byId(state, id));
    }

    expect(calculateFinalPlacements(state)).toEqual([
      { place: 7, teamIds: ["s5", "s6"] },
    ]);
    expect(isEliminationComplete(state)).toBe(false);
  });

  it("returns every team exactly once when complete", () => {
    const finished = playAll(generateDoubleEliminationBracket(seeds(8)).bracket);
    const placements = calculateFinalPlacements(finished);
    const placed = placements.flatMap((placement) => placement.teamIds);

    expect(new Set(placed).size).toBe(8);
    expect(placed).toHaveLength(8);
  });

  it("handles an uneven bracket", () => {
    const finished = playAll(generateDoubleEliminationBracket(seeds(5)).bracket);
    const placements = calculateFinalPlacements(finished);

    expect(placements.flatMap((p) => p.teamIds)).toHaveLength(5);
    expect(placements[0]).toEqual({ place: 1, teamIds: ["s1"] });
    expect(placements[placements.length - 1]).toEqual({
      place: 5,
      teamIds: ["s4"],
    });
  });

  it("places both finalists correctly after a reset", () => {
    let state = generateDoubleEliminationBracket(seeds(8)).bracket;

    while (byId(state, "grand-final-1").status !== "ready") {
      const next = listEliminationMatches(state).find(
        (match) => match.status === "ready" && match.phase !== "grand-final"
      );
      if (!next) throw new Error("No match available.");
      state = play(state, next);
    }

    state = play(state, byId(state, "grand-final-1"), "teamB");
    state = play(state, byId(state, "grand-final-2"), "teamA");

    expect(calculateFinalPlacements(state).slice(0, 2)).toEqual([
      { place: 1, teamIds: ["s1"] },
      { place: 2, teamIds: ["s8"] },
    ]);
  });
});
