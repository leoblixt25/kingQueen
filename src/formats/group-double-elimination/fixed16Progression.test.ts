import { describe, expect, it } from "vitest";
import type { EliminationBracket, GroupStageMatch, Team, TeamId } from "./types";
import { applyGroupMatchScore } from "./groupStageMatches";
import {
  FIXED16_ADVANCE_OPTIONS,
  buildFixed16EliminationStage,
  buildFixed16GroupStage,
} from "./fixed16";
import {
  findEliminationMatch,
  listEliminationMatches,
  validateEliminationBracket,
} from "./bracket";
import {
  advanceEliminationMatch,
  getEliminationChampion,
  getEliminationLossCount,
  isEliminationComplete,
  needsGrandFinalReset,
} from "./progression";
import {
  calculateEliminationStandings,
  calculateFinalPlacements,
} from "./eliminationStandings";
import { GAME_IDS_16, getGameNumber } from "./gameNumbers";

const makeTeams = (): Team[] =>
  Array.from({ length: 16 }, (_, index) => ({
    id: `t${index + 1}`,
    name: `Team ${index + 1}`,
    playerIds: [],
    seed: index + 1,
    groupId: null,
  }));

const finishGroups = (matches: readonly GroupStageMatch[]): GroupStageMatch[] =>
  matches.map((match) =>
    applyGroupMatchScore(
      match,
      match.teamAId < match.teamBId ? 21 : 10,
      match.teamAId < match.teamBId ? 10 : 21
    )
  );

const readyMatches = (bracket: EliminationBracket) =>
  listEliminationMatches(bracket)
    .filter(
      (match) =>
        match.status === "ready" && match.teamAId && match.teamBId
    )
    .sort(
      (a, b) => (getGameNumber(a.id) ?? 999) - (getGameNumber(b.id) ?? 999)
    );

const play = (
  bracket: EliminationBracket,
  matchId: string,
  winnerId: TeamId
) => {
  const current = findEliminationMatch(bracket, matchId);
  if (!current || !current.teamAId || !current.teamBId) {
    throw new Error(`Match ${matchId} is not playable`);
  }
  const loserId =
    current.teamAId === winnerId ? current.teamBId : current.teamAId;

  return advanceEliminationMatch(
    bracket,
    { matchId, winnerId, loserId },
    FIXED16_ADVANCE_OPTIONS
  );
};

interface RunResult {
  bracket: EliminationBracket;
  semifinalPairings: Array<{
    matchId: string;
    teamAId: TeamId;
    teamBId: TeamId;
  }>;
  eliminatedByLoss: number;
}

const runFullTournament = (
  decide: (matchId: string, teamA: TeamId, teamB: TeamId) => TeamId
): RunResult => {
  const teams = makeTeams();
  const stage = buildFixed16GroupStage(teams);
  const elimination = buildFixed16EliminationStage({
    ...stage,
    matches: finishGroups(stage.matches),
  });

  let bracket = elimination.bracket;
  const semifinalPairings: RunResult["semifinalPairings"] = [];
  let eliminatedByLoss = 0;
  let guard = 0;

  while (!isEliminationComplete(bracket)) {
    const next = readyMatches(bracket)[0];
    if (!next || !next.teamAId || !next.teamBId) {
      throw new Error("Tournament is stuck with no ready match.");
    }

    if (
      next.id === GAME_IDS_16.semiFinal1 ||
      next.id === GAME_IDS_16.semiFinal2
    ) {
      semifinalPairings.push({
        matchId: next.id,
        teamAId: next.teamAId,
        teamBId: next.teamBId,
      });
    }

    const winnerId = decide(next.id, next.teamAId, next.teamBId);
    const result = play(bracket, next.id, winnerId);
    bracket = result.bracket;
    if (result.eliminatedTeamId) eliminatedByLoss += 1;

    guard += 1;
    if (guard > 100) throw new Error("Tournament did not finish.");
  }

  return { bracket, semifinalPairings, eliminatedByLoss };
};

describe("full fixed 16-team elimination run", () => {
  it("plays every ready match and finishes with a champion", () => {
    const { bracket } = runFullTournament((_id, teamA) => teamA);

    expect(isEliminationComplete(bracket)).toBe(true);
    expect(getEliminationChampion(bracket)).not.toBeNull();
    expect(validateEliminationBracket(bracket)).toEqual([]);
  });

  it("uses the mandatory Spanish semifinal crossover", () => {
    const { semifinalPairings, bracket } = runFullTournament(
      (_id, teamA) => teamA
    );

    expect(semifinalPairings).toHaveLength(2);

    const game25 = findEliminationMatch(bracket, GAME_IDS_16.game25);
    const game22 = findEliminationMatch(bracket, GAME_IDS_16.game22);
    const game26 = findEliminationMatch(bracket, GAME_IDS_16.game26);
    const game21 = findEliminationMatch(bracket, GAME_IDS_16.game21);

    expect(semifinalPairings[0]).toEqual({
      matchId: GAME_IDS_16.semiFinal1,
      teamAId: game25?.winnerId,
      teamBId: game22?.winnerId,
    });
    expect(semifinalPairings[1]).toEqual({
      matchId: GAME_IDS_16.semiFinal2,
      teamAId: game26?.winnerId,
      teamBId: game21?.winnerId,
    });
  });

  it("never eliminates a team before its second loss", () => {
    const { bracket } = runFullTournament((_id, teamA) => teamA);
    const champion = getEliminationChampion(bracket);
    const lowerFinal = findEliminationMatch(bracket, GAME_IDS_16.lowerFinal);
    const lowerWinner =
      lowerFinal?.status === "completed" ? lowerFinal.winnerId : null;

    for (const team of makeTeams()) {
      const losses = getEliminationLossCount(bracket, team.id);
      expect(losses).toBeLessThanOrEqual(2);

      // A double-elimination team is only out after two losses. The champion
      // and the lower-final winner may finish earlier with fewer losses; in
      // the Spanish crossover both can carry a single loss.
      if (team.id !== champion && team.id !== lowerWinner) {
        expect(losses).toBe(2);
      }
    }
  });

  it("reports final placements for all 16 teams with shared places", () => {
    const { bracket } = runFullTournament((_id, teamA) => teamA);
    const placements = calculateFinalPlacements(bracket);
    const placed = placements.flatMap((placement) => placement.teamIds);

    expect(new Set(placed).size).toBe(16);
    expect(placements[0].place).toBe(1);
    expect(placements.some((placement) => placement.teamIds.length > 1)).toBe(
      true
    );

    const standings = calculateEliminationStandings(bracket);
    expect(standings).toHaveLength(16);
    expect(standings.filter((row) => row.status === "champion")).toHaveLength(1);
    // The champion and the lower-final winner finish on one loss; the other
    // 14 teams are eliminated on their second loss.
    expect(standings.filter((row) => row.status === "eliminated")).toHaveLength(
      14
    );
  });

  it("creates and decides a reset final when an undefeated finalist loses", () => {
    // Let the undefeated (source 21/22) teams win both semifinals so the
    // Grand Final is contested by two teams on zero losses. The first final
    // then always produces a winner with one loss, forcing the reset.
    const { bracket } = runFullTournament((matchId, teamA, teamB) =>
      matchId === GAME_IDS_16.semiFinal1 || matchId === GAME_IDS_16.semiFinal2
        ? teamB
        : teamA
    );

    expect(bracket.grandFinal).toHaveLength(2);
    expect(bracket.resetFinalRequired).toBe(true);
    expect(needsGrandFinalReset(bracket)).toBe(false);
    expect(getEliminationChampion(bracket)).not.toBeNull();
  });
});
