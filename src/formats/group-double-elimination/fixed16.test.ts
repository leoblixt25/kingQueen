import { describe, expect, it } from "vitest";
import type { GroupStageMatch, Team } from "./types";
import { applyGroupMatchScore, getGroupStageProgress } from "./groupStageMatches";
import {
  FIXED16_GROUP_MATCH_COUNT,
  assertFixed16Teams,
  buildFixed16EliminationStage,
  buildFixed16GroupStage,
  canGenerateFixed16Bracket,
  getFixed16GlobalRanking,
  type Fixed16TournamentState,
} from "./fixed16";
import {
  calculateAllGroupStandings,
  seedTeamsFromGroupStandings,
} from "./groupStandings";
import { hasSpanishCrossover } from "./spanishCrossover";
import { validateEliminationBracket } from "./bracket";
import { EliminationError, GroupStageError } from "./errors";

const makeTeams = (count = 16): Team[] =>
  Array.from({ length: count }, (_, index) => ({
    id: `t${index + 1}`,
    name: `Team ${index + 1}`,
    playerIds: [],
    seed: index + 1,
    groupId: null,
  }));

/** Better seed always wins with a margin that decreases with seed number. */
const finishGroupStage = (
  matches: readonly GroupStageMatch[],
  teams: readonly Team[]
): GroupStageMatch[] => {
  const seeds = new Map(teams.map((team) => [team.id, team.seed ?? 99]));

  return matches.map((match) => {
    const seedA = seeds.get(match.teamAId) ?? 99;
    const seedB = seeds.get(match.teamBId) ?? 99;
    const winnerIsA =
      seedA < seedB || (seedA === seedB && match.teamAId < match.teamBId);
    const winnerSeed = Math.min(seedA, seedB);
    const winnerScore = 21 + (16 - winnerSeed);
    const loserScore = 10;

    return applyGroupMatchScore(
      match,
      winnerIsA ? winnerScore : loserScore,
      winnerIsA ? loserScore : winnerScore
    );
  });
};

const makeState = (): Fixed16TournamentState => {
  const teams = makeTeams();
  return { teams, groupStage: buildFixed16GroupStage(teams), elimination: null };
};

describe("fixed 16-team group stage", () => {
  it("creates 4 groups of 4 and exactly 24 matches", () => {
    const state = makeState();

    expect(state.groupStage.groups).toHaveLength(4);
    expect(
      state.groupStage.groups.every((group) => group.teamIds.length === 4)
    ).toBe(true);
    expect(state.groupStage.matches).toHaveLength(FIXED16_GROUP_MATCH_COUNT);
    expect(state.groupStage.matches).toHaveLength(24);
    expect(getGroupStageProgress(state.groupStage.matches)).toEqual({
      total: 24,
      completed: 0,
      remaining: 24,
      isComplete: false,
    });
  });

  it("gives every group 6 unique round-robin matches", () => {
    const { matches } = makeState().groupStage;

    for (let groupNumber = 1; groupNumber <= 4; groupNumber += 1) {
      const groupMatches = matches.filter((match) =>
        match.id.startsWith(`group-${groupNumber}-`)
      );
      expect(groupMatches).toHaveLength(6);
      expect(new Set(groupMatches.map((match) => match.id)).size).toBe(6);

      const pairs = groupMatches.map((match) =>
        [match.teamAId, match.teamBId].sort().join("|")
      );
      expect(new Set(pairs).size).toBe(6);
    }
  });

  it("rejects any team count other than 16", () => {
    expect(() => buildFixed16GroupStage(makeTeams(15))).toThrowError(
      GroupStageError
    );
    expect(() => buildFixed16GroupStage(makeTeams(17))).toThrowError(
      GroupStageError
    );
    expect(() => assertFixed16Teams(makeTeams(16))).not.toThrow();
  });

  it("blocks bracket generation until all 24 matches are complete", () => {
    const state = makeState();
    expect(canGenerateFixed16Bracket(state.groupStage.matches)).toBe(false);
    expect(() => buildFixed16EliminationStage(state.groupStage)).toThrowError(
      EliminationError
    );

    const partial = finishGroupStage(
      state.groupStage.matches.slice(0, 23),
      state.teams
    );
    expect(canGenerateFixed16Bracket(partial)).toBe(false);
  });
});

describe("global ranking 1-16", () => {
  it("produces unique ranks 1 through 16", () => {
    const state = makeState();
    const matches = finishGroupStage(state.groupStage.matches, state.teams);
    const ranking = getFixed16GlobalRanking(state.groupStage.groups, matches);

    expect(ranking).toHaveLength(16);
    expect(ranking.map((row) => row.globalRank)).toEqual(
      Array.from({ length: 16 }, (_, index) => index + 1)
    );
    expect(new Set(ranking.map((row) => row.teamId)).size).toBe(16);
  });

  it("orders teams by group rank, then the approved tiebreakers", () => {
    const state = makeState();
    const matches = finishGroupStage(state.groupStage.matches, state.teams);
    const tables = calculateAllGroupStandings(state.groupStage.groups, matches);
    const ranking = getFixed16GlobalRanking(state.groupStage.groups, matches);

    expect(ranking.map((row) => row.teamId)).toEqual(
      seedTeamsFromGroupStandings(tables)
    );
  });

  it("seeds the exact team order used by the facade", () => {
    const state = makeState();
    const matches = finishGroupStage(state.groupStage.matches, state.teams);
    const ranking = getFixed16GlobalRanking(state.groupStage.groups, matches);

    // The score pattern above makes the global ranking equal to the initial
    // seeds; this is a property of the fixture, not a format rule.
    expect(ranking.map((row) => row.teamId)).toEqual(
      makeTeams().map((team) => team.id)
    );
    expect(ranking[0]).toMatchObject({
      globalRank: 1,
      groupRank: 1,
      wins: 3,
      losses: 0,
    });
    expect(ranking[15]).toMatchObject({
      globalRank: 16,
      groupRank: 4,
      wins: 0,
      losses: 3,
    });
  });
});

describe("fixed 16-team bracket generation", () => {
  const state = makeState();
  const matches = finishGroupStage(state.groupStage.matches, state.teams);
  const stage = { ...state.groupStage, matches };
  const elimination = buildFixed16EliminationStage(stage);

  it("accepts all 16 teams in global-ranking order", () => {
    expect(elimination.seededTeamIds).toHaveLength(16);
    expect(elimination.seededTeamIds).toEqual(
      getFixed16GlobalRanking(stage.groups, matches).map((row) => row.teamId)
    );
    expect(elimination.bracket.bracketSize).toBe(16);
  });

  it("generates winners, losers and Grand Final matches with unique ids", () => {
    expect(elimination.bracket.winners).toHaveLength(15);
    expect(elimination.bracket.losers).toHaveLength(14);
    expect(elimination.bracket.grandFinal).toHaveLength(1);
    expect(validateEliminationBracket(elimination.bracket)).toEqual([]);
  });

  it("uses the canonical standard bracket without a crossover", () => {
    expect(hasSpanishCrossover(elimination.bracket)).toBe(false);
    expect(validateEliminationBracket(elimination.bracket)).toEqual([]);
  });

  it("starts every team with zero elimination losses", () => {
    const lossMakers = [
      ...elimination.bracket.winners,
      ...elimination.bracket.losers,
      ...elimination.bracket.grandFinal,
    ];
    expect(lossMakers.every((match) => match.loserId === null)).toBe(true);
  });
});
