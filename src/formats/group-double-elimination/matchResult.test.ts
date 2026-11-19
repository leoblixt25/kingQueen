import { describe, expect, it } from "vitest";
import type { EliminationMatch, Team } from "./types";
import {
  createGsdeTournamentDocument,
  type GsdeTournamentDocument,
} from "./persistence";
import {
  buildTeamsAndGroups,
  correctEliminationResult,
  generateEliminationBracket,
  scoreEliminationMatch,
  scoreGroupMatch,
  selectGroupStandings,
  ScoringError,
} from "./scoring";
import { findEliminationMatch } from "./bracket";
import {
  deriveWinner,
  getLoser,
  getResultType,
  getWinner,
  resultTypeBadge,
  resolveEliminationResult,
  walkoverScores,
} from "./matchResult";
import { findWinnerScoreConflicts } from "./integrity";

const makeTeams = (): Team[] =>
  Array.from({ length: 16 }, (_, index) => ({
    id: `t${index + 1}`,
    name: `Team ${index + 1}`,
    playerIds: [],
    seed: index + 1,
    groupId: null,
  }));

const readyDoc = (): GsdeTournamentDocument =>
  buildTeamsAndGroups(createGsdeTournamentDocument("event-1"), makeTeams());

/** Better seed wins each group match. */
const playGroups = (doc: GsdeTournamentDocument): GsdeTournamentDocument => {
  const seeds = new Map(doc.teams.map((team) => [team.id, team.seed ?? 99]));
  let current = doc;

  for (const match of [...doc.matches]) {
    const scoreA =
      (seeds.get(match.teamAId) ?? 99) < (seeds.get(match.teamBId) ?? 99) ? 21 : 10;
    current = scoreGroupMatch(
      current,
      match.id,
      scoreA,
      scoreA === 21 ? 10 : 21
    );
  }

  return current;
};

const makeEliminationDoc = (): GsdeTournamentDocument =>
  generateEliminationBracket(playGroups(readyDoc()));

const firstEliminationMatch = (doc: GsdeTournamentDocument): EliminationMatch =>
  findEliminationMatch(doc.elimination!, "winners-r1-m1")!;

const capture = (action: () => unknown): ScoringError => {
  try {
    action();
  } catch (error) {
    if (error instanceof ScoringError) return error;
    throw error;
  }
  throw new Error("Expected a ScoringError");
};

describe("elimination result helpers", () => {
  it("derives the winner solely from the scores", () => {
    expect(deriveWinner("a", "b", 21, 10)).toBe("a");
    expect(deriveWinner("a", "b", 10, 21)).toBe("b");
    expect(deriveWinner("a", "b", 21, 21)).toBeNull();
  });

  it("derives the winner from extended beach-volleyball scores", () => {
    expect(deriveWinner("a", "b", 22, 20)).toBe("a");
    expect(deriveWinner("a", "b", 23, 21)).toBe("a");
    expect(deriveWinner("a", "b", 25, 23)).toBe("a");
    expect(deriveWinner("a", "b", 23, 25)).toBe("b");
    expect(deriveWinner("a", "b", 20, 20)).toBeNull();
  });

  it("ignores a supplied winner flag when scores are present", () => {
    const match = {
      teamAId: "a",
      teamBId: "b",
      scoreA: null,
      scoreB: null,
    } as EliminationMatch;

    const result = resolveEliminationResult(match, {
      scoreA: 10,
      scoreB: 21,
      winnerId: "a",
      loserId: "b",
    });

    expect(result.winnerId).toBe("b");
    expect(result.loserId).toBe("a");
  });

  it("keeps a legacy winner when no scores exist", () => {
    const match = {
      teamAId: "a",
      teamBId: "b",
      scoreA: null,
      scoreB: null,
    } as EliminationMatch;

    const result = resolveEliminationResult(match, {
      winnerId: "a",
      loserId: "b",
    });

    expect(result.winnerId).toBe("a");
    expect(result.scoreA).toBeNull();
    expect(result.scoreB).toBeNull();
  });
});

describe("score-driven elimination results", () => {
  it("the higher score always advances, even over a contradictory winner flag", () => {
    const doc = makeEliminationDoc();
    const match = firstEliminationMatch(doc);

    const next = scoreEliminationMatch(doc, {
      matchId: match.id,
      // Deliberately contradicts the scores — scores must win.
      winnerId: match.teamAId!,
      loserId: match.teamBId!,
      scoreA: 10,
      scoreB: 21,
    });
    const saved = findEliminationMatch(next.elimination!, match.id)!;

    expect(saved.scoreA).toBe(10);
    expect(saved.scoreB).toBe(21);
    expect(getWinner(saved)).toBe(match.teamBId);
    expect(getLoser(saved)).toBe(match.teamAId);
    expect(saved.winnerId).toBe(match.teamBId);
    expect(saved.loserId).toBe(match.teamAId);
  });

  it("advances the team with the higher valid extended score", () => {
    const doc = makeEliminationDoc();
    const match = firstEliminationMatch(doc);

    const next = scoreEliminationMatch(doc, {
      matchId: match.id,
      scoreA: 22,
      scoreB: 20,
    });
    const saved = findEliminationMatch(next.elimination!, match.id)!;

    expect(getWinner(saved)).toBe(match.teamAId);
    expect(getLoser(saved)).toBe(match.teamBId);
    expect(saved.status).toBe("completed");
  });

  it("rejects a tie", () => {
    const doc = makeEliminationDoc();
    const match = firstEliminationMatch(doc);

    expect(
      capture(() =>
        scoreEliminationMatch(doc, {
          matchId: match.id,
          scoreA: 21,
          scoreB: 21,
        })
      ).code
    ).toBe("invalid-score");
  });

  it("a walkover advances the chosen team without affecting group point differential", () => {
    const doc = makeEliminationDoc();
    const match = firstEliminationMatch(doc);
    const marker = walkoverScores(false); // team B advances

    const pointDifferentials = () =>
      selectGroupStandings(doc).flatMap((table) =>
        table.rows.map((row) => row.pointDifference)
      );
    const before = pointDifferentials();

    const next = scoreEliminationMatch(doc, {
      matchId: match.id,
      scoreA: marker.scoreA,
      scoreB: marker.scoreB,
      resultType: "walkover",
    });
    const saved = findEliminationMatch(next.elimination!, match.id)!;

    expect(saved.scoreA).toBe(0);
    expect(saved.scoreB).toBe(1);
    expect(getWinner(saved)).toBe(match.teamBId);
    expect(getLoser(saved)).toBe(match.teamAId);
    expect(getResultType(saved)).toBe("walkover");
    expect(resultTypeBadge(saved.resultType)).toBe("W/O");
    expect(selectGroupStandings(next)).toEqual(selectGroupStandings(doc));
    expect(pointDifferentials()).toEqual(before);
  });

  it("replays a legacy no-score result without invalidating it", () => {
    const doc = makeEliminationDoc();
    const match = firstEliminationMatch(doc);
    const noScore = scoreEliminationMatch(doc, {
      matchId: match.id,
      winnerId: match.teamAId!,
      loserId: match.teamBId!,
    });

    const corrected = correctEliminationResult(noScore, match.id, {
      winnerId: match.teamBId!,
      loserId: match.teamAId!,
    });
    const saved = findEliminationMatch(corrected.elimination!, match.id)!;

    expect(getWinner(saved)).toBe(match.teamBId);
    expect(corrected.elimination!.invalidatedResultIds).toEqual([]);
  });

  it("flags a saved match whose stored winner contradicts its scores", () => {
    const doc = makeEliminationDoc();
    const match = firstEliminationMatch(doc);
    const scored = scoreEliminationMatch(doc, {
      matchId: match.id,
      scoreA: 21,
      scoreB: 10,
    });
    const saved = findEliminationMatch(scored.elimination!, match.id)!;

    // Simulate a legacy record with a stale winner flag.
    const corrupted: GsdeTournamentDocument = {
      ...scored,
      elimination: {
        ...scored.elimination!,
        winners: scored.elimination!.winners.map((candidate) =>
          candidate.id === match.id
            ? {
                ...candidate,
                winnerId: candidate.teamBId,
                loserId: candidate.teamAId,
              }
            : candidate
        ),
      },
    };

    expect(findWinnerScoreConflicts(corrupted)).toEqual([
      {
        matchId: match.id,
        storedWinnerId: match.teamBId,
        scoreWinnerId: match.teamAId,
      },
    ]);
    // Routing still follows the scores, never the stale flag.
    expect(getWinner(findEliminationMatch(corrupted.elimination!, match.id)!)).toBe(
      saved.teamAId
    );
  });
});
