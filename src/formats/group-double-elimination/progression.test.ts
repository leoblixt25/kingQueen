import { describe, expect, it } from "vitest";
import type { EliminationBracket, EliminationMatch, TeamId } from "./types";
import {
  generateDoubleEliminationBracket,
  listEliminationMatches,
} from "./bracket";
import {
  advanceEliminationMatch,
  getEliminationChampion,
  getEliminationLossCount,
  isEliminationComplete,
  needsGrandFinalReset,
} from "./progression";
import { calculateFinalPlacements } from "./eliminationStandings";
import { EliminationError } from "./errors";

const seeds = (count: number): TeamId[] =>
  Array.from({ length: count }, (_, index) => `s${index + 1}`);

const readyMatches = (bracket: EliminationBracket): EliminationMatch[] =>
  listEliminationMatches(bracket).filter((match) => match.status === "ready");

const captureError = (action: () => unknown): EliminationError => {
  try {
    action();
  } catch (error) {
    if (error instanceof EliminationError) return error;
    throw error;
  }
  throw new Error("Expected an EliminationError");
};

const play = (
  bracket: EliminationBracket,
  match: EliminationMatch,
  winner: "teamA" | "teamB"
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
  });

const playAll = (
  bracket: EliminationBracket,
  decide: (match: EliminationMatch) => "teamA" | "teamB" = () => "teamA"
): EliminationBracket => {
  let current = bracket;
  let guard = 0;

  while (!isEliminationComplete(current)) {
    const next = readyMatches(current)[0];
    if (!next) throw new Error("Bracket is stuck with no ready match.");
    current = play(current, next, decide(next)).bracket;

    guard += 1;
    if (guard > 200) throw new Error("Bracket did not finish.");
  }

  return current;
};

const byId = (bracket: EliminationBracket, id: string) => {
  const match = listEliminationMatches(bracket).find((m) => m.id === id);
  if (!match) throw new Error(`Missing match ${id}`);
  return match;
};

/** Plays every playable non-final match so the Grand Final is ready. */
const playUntilFinal = (bracket: EliminationBracket): EliminationBracket => {
  let state = bracket;

  while (byId(state, "grand-final-1").status !== "ready") {
    const next = readyMatches(state).find(
      (match) => match.phase !== "grand-final"
    );
    if (!next) throw new Error("No match can be played before the final.");
    state = play(state, next, "teamA").bracket;
  }

  return state;
};

describe("progression through the Winners Bracket", () => {
  const { bracket } = generateDoubleEliminationBracket(seeds(8));

  it("fills the next round as winners arrive", () => {
    const first = byId(bracket, "winners-r1-m1");
    const second = byId(bracket, "winners-r1-m2");

    let state = play(bracket, first, "teamA").bracket;
    expect(byId(state, "winners-r2-m1").teamAId).toBe("s1");
    expect(byId(state, "winners-r2-m1").status).toBe("pending");

    state = play(state, second, "teamA").bracket;
    expect(byId(state, "winners-r2-m1")).toMatchObject({
      teamAId: "s1",
      teamBId: "s4",
      status: "ready",
    });
  });

  it("sends the first loss to the Losers Bracket without eliminating", () => {
    const result = play(bracket, byId(bracket, "winners-r1-m1"), "teamA");

    expect(result.eliminatedTeamId).toBeNull();
    expect(result.bracket.resetFinalRequired).toBe(false);
    expect(getEliminationLossCount(result.bracket, "s8")).toBe(1);
    expect(byId(result.bracket, "losers-r1-m1").teamAId).toBe("s8");
  });

  it("eliminates on the second loss", () => {
    let state = play(bracket, byId(bracket, "winners-r1-m1"), "teamA").bracket;
    state = play(state, byId(state, "winners-r1-m2"), "teamA").bracket;

    const result = play(state, byId(state, "losers-r1-m1"), "teamA");

    expect(getEliminationLossCount(result.bracket, "s5")).toBe(2);
    expect(result.eliminatedTeamId).toBe("s5");
  });

  it("does not eliminate a winners-bracket loser twice", () => {
    let state = bracket;
    for (const id of ["winners-r1-m1", "winners-r1-m2"]) {
      const result = play(state, byId(state, id), "teamA");
      expect(result.eliminatedTeamId).toBeNull();
      state = result.bracket;
    }
  });
});

describe("full 8-team run", () => {
  const finished = playAll(generateDoubleEliminationBracket(seeds(8)).bracket);

  it("finishes with the expected champion", () => {
    expect(isEliminationComplete(finished)).toBe(true);
    expect(getEliminationChampion(finished)).toBe("s1");
    expect(finished.grandFinal).toHaveLength(1);
    expect(finished.resetFinalRequired).toBe(false);
    expect(needsGrandFinalReset(finished)).toBe(false);
  });

  it("gives every non-champion exactly two elimination losses", () => {
    for (const teamId of seeds(8)) {
      const expected = teamId === "s1" ? 0 : 2;
      expect(getEliminationLossCount(finished, teamId)).toBe(expected);
    }
  });

  it("computes competition placements with ties", () => {
    expect(calculateFinalPlacements(finished)).toEqual([
      { place: 1, teamIds: ["s1"] },
      { place: 2, teamIds: ["s8"] },
      { place: 3, teamIds: ["s2"] },
      { place: 4, teamIds: ["s7"] },
      { place: 5, teamIds: ["s4", "s3"] },
      { place: 7, teamIds: ["s5", "s6"] },
    ]);
  });
});

describe("Grand Final and the reset final", () => {
  it("ends the tournament when the Winners champion wins the first final", () => {
    const ready = playUntilFinal(generateDoubleEliminationBracket(seeds(8)).bracket);
    const result = play(ready, byId(ready, "grand-final-1"), "teamA");

    expect(result.resetFinalRequired).toBe(false);
    expect(result.eliminatedTeamId).toBe("s8");
    expect(result.bracket.grandFinal).toHaveLength(1);
  });

  it("creates a reset final when the Losers champion wins", () => {
    const ready = playUntilFinal(generateDoubleEliminationBracket(seeds(8)).bracket);
    const first = byId(ready, "grand-final-1");
    const result = play(ready, first, "teamB");

    expect(result.resetFinalRequired).toBe(true);
    expect(result.eliminatedTeamId).toBeNull();
    expect(result.bracket.grandFinal).toHaveLength(2);
    expect(result.bracket.grandFinal[1]).toMatchObject({
      id: "grand-final-2",
      round: 2,
      teamAId: first.teamAId,
      teamBId: first.teamBId,
      status: "ready",
    });
    expect(needsGrandFinalReset(result.bracket)).toBe(true);
    expect(getEliminationChampion(result.bracket)).toBeNull();
  });

  it("decides the champion in the reset final", () => {
    const ready = playUntilFinal(generateDoubleEliminationBracket(seeds(8)).bracket);
    let state = play(ready, byId(ready, "grand-final-1"), "teamB").bracket;
    const reset = byId(state, "grand-final-2");
    const result = play(state, reset, "teamA");

    expect(result.eliminatedTeamId).toBe(reset.teamBId);
    expect(getEliminationChampion(result.bracket)).toBe(reset.teamAId);
    expect(needsGrandFinalReset(result.bracket)).toBe(false);
    expect(isEliminationComplete(result.bracket)).toBe(true);
  });

  it("runs the reset path through a whole tournament", () => {
    const finished = playAll(
      generateDoubleEliminationBracket(seeds(8)).bracket,
      (match) =>
        match.phase === "grand-final" && match.round === 1 ? "teamB" : "teamA"
    );

    expect(finished.grandFinal).toHaveLength(2);
    expect(finished.resetFinalRequired).toBe(true);
    expect(getEliminationChampion(finished)).toBe("s1");
    expect(calculateFinalPlacements(finished)[0]).toEqual({
      place: 1,
      teamIds: ["s1"],
    });
  });
});

describe("progression with byes and small brackets", () => {
  it("finishes a 5-team bracket", () => {
    const finished = playAll(generateDoubleEliminationBracket(seeds(5)).bracket);

    expect(getEliminationChampion(finished)).toBe("s1");
    expect(calculateFinalPlacements(finished)).toEqual([
      { place: 1, teamIds: ["s1"] },
      { place: 2, teamIds: ["s5"] },
      { place: 3, teamIds: ["s2"] },
      { place: 4, teamIds: ["s3"] },
      { place: 5, teamIds: ["s4"] },
    ]);
  });

  it("finishes a 3-team bracket", () => {
    const finished = playAll(generateDoubleEliminationBracket(seeds(3)).bracket);

    expect(getEliminationChampion(finished)).toBe("s1");
    expect(calculateFinalPlacements(finished)).toHaveLength(3);
  });

  it("finishes a 2-team bracket through the reset final", () => {
    const { bracket } = generateDoubleEliminationBracket(seeds(2));
    let state = play(bracket, byId(bracket, "winners-r1-m1"), "teamA").bracket;

    expect(byId(state, "grand-final-1")).toMatchObject({
      teamAId: "s1",
      teamBId: "s2",
      status: "ready",
    });

    state = play(state, byId(state, "grand-final-1"), "teamB").bracket;
    expect(state.grandFinal).toHaveLength(2);

    const finished = playAll(state);
    expect(getEliminationChampion(finished)).toBe("s1");
    expect(calculateFinalPlacements(finished)).toEqual([
      { place: 1, teamIds: ["s1"] },
      { place: 2, teamIds: ["s2"] },
    ]);
  });

  it("keeps results deterministic", () => {
    const first = playAll(generateDoubleEliminationBracket(seeds(6)).bracket);
    const second = playAll(generateDoubleEliminationBracket(seeds(6)).bracket);

    expect(first).toEqual(second);
  });
});

describe("progression errors", () => {
  const { bracket } = generateDoubleEliminationBracket(seeds(8));

  it("rejects unknown matches", () => {
    expect(
      captureError(() =>
        advanceEliminationMatch(bracket, {
          matchId: "nope",
          winnerId: "s1",
          loserId: "s8",
        })
      ).code
    ).toBe("unknown-match");
  });

  it("rejects a match that is still waiting for teams", () => {
    expect(
      captureError(() =>
        advanceEliminationMatch(bracket, {
          matchId: "winners-r2-m1",
          winnerId: "s1",
          loserId: "s4",
        })
      ).code
    ).toBe("invalid-match");
  });

  it("rejects an outcome that does not match the participants", () => {
    expect(
      captureError(() =>
        advanceEliminationMatch(bracket, {
          matchId: "winners-r1-m1",
          winnerId: "s1",
          loserId: "s2",
        })
      ).code
    ).toBe("invalid-outcome");
  });

  it("rejects invalid scores", () => {
    expect(
      captureError(() =>
        advanceEliminationMatch(bracket, {
          matchId: "winners-r1-m1",
          winnerId: "s1",
          loserId: "s8",
          scoreA: 21,
          scoreB: 21,
        })
      ).code
    ).toBe("invalid-outcome");
  });

  it("rejects scores that contradict the winner", () => {
    expect(
      captureError(() =>
        advanceEliminationMatch(bracket, {
          matchId: "winners-r1-m1",
          winnerId: "s1",
          loserId: "s8",
          scoreA: 10,
          scoreB: 21,
        })
      ).code
    ).toBe("invalid-outcome");
  });

  it("rejects replaying a completed match", () => {
    const played = play(bracket, byId(bracket, "winners-r1-m1"), "teamA").bracket;

    expect(
      captureError(() =>
        advanceEliminationMatch(played, {
          matchId: "winners-r1-m1",
          winnerId: "s1",
          loserId: "s8",
        })
      ).code
    ).toBe("match-completed");
  });
});
