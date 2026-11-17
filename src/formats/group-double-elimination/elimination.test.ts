import { describe, expect, it } from "vitest";
import type { GroupStageState } from "./groupStage";
import type { Team } from "./types";
import { buildGroupStage } from "./groupStage";
import { applyGroupMatchScore } from "./groupStageMatches";
import {
  calculateAllGroupStandings,
  seedTeamsFromGroupStandings,
} from "./groupStandings";
import { buildEliminationStage } from "./elimination";
import { validateEliminationBracket } from "./bracket";
import { calculateEliminationStandings } from "./eliminationStandings";
import { getEliminationLossCount } from "./progression";
import { EliminationError } from "./errors";

const makeTeams = (count: number): Team[] =>
  Array.from({ length: count }, (_, index) => ({
    id: `t${index + 1}`,
    name: `Team ${index + 1}`,
    playerIds: [],
    seed: index + 1,
    groupId: null,
  }));

/** t8 loses every group match; every other match is won by team A. */
const finishGroupStage = (stage: GroupStageState): GroupStageState => ({
  ...stage,
  matches: stage.matches.map((match) => {
    if (match.teamAId === "t8") return applyGroupMatchScore(match, 10, 21);
    if (match.teamBId === "t8") return applyGroupMatchScore(match, 21, 10);
    return applyGroupMatchScore(match, 21, 15);
  }),
});

const captureError = (action: () => unknown): EliminationError => {
  try {
    action();
  } catch (error) {
    if (error instanceof EliminationError) return error;
    throw error;
  }
  throw new Error("Expected an EliminationError");
};

describe("seeding the elimination stage from the group stage", () => {
  const stage = buildGroupStage(makeTeams(8), 2);

  it("refuses to seed before the group stage is complete", () => {
    expect(captureError(() => buildEliminationStage(stage)).code).toBe(
      "group-stage-incomplete"
    );
  });

  it("can preview a partially played group stage on request", () => {
    const elimination = buildEliminationStage(stage, {
      allowIncompleteGroupStage: true,
    });

    expect(elimination.seededTeamIds).toHaveLength(8);
    expect(validateEliminationBracket(elimination.bracket)).toEqual([]);
  });

  it("uses the group standings as the seed order", () => {
    const finished = finishGroupStage(stage);
    const elimination = buildEliminationStage(finished);
    const expected = seedTeamsFromGroupStandings(
      calculateAllGroupStandings(finished.groups, finished.matches)
    );

    expect(elimination.seededTeamIds).toEqual(expected);
    expect(new Set(elimination.seededTeamIds).size).toBe(8);
    expect(elimination.seededTeamIds[7]).toBe("t8");
    expect(validateEliminationBracket(elimination.bracket)).toEqual([]);
  });

  it("accepts every qualified team, including winless group teams", () => {
    const finished = finishGroupStage(stage);
    const { bracket, seededTeamIds } = buildEliminationStage(finished);

    expect(new Set(seededTeamIds)).toEqual(
      new Set(makeTeams(8).map((team) => team.id))
    );

    const standings = calculateEliminationStandings(bracket);
    expect(standings).toHaveLength(8);
    expect(getEliminationLossCount(bracket, "t8")).toBe(0);
    expect(standings.find((row) => row.teamId === "t8")).toMatchObject({
      wins: 0,
      losses: 0,
      status: "winners",
      rank: null,
    });
  });

  it("keeps group records out of the elimination bracket", () => {
    const finished = finishGroupStage(stage);
    const { bracket } = buildEliminationStage(finished);

    expect(bracket.seededTeamIds).toHaveLength(8);
    expect(
      "groupMatches" in bracket || "groups" in bracket
    ).toBe(false);
    expect(
      bracket.winners.every(
        (match) => !("groupId" in match) && !("groupRound" in match)
      )
    ).toBe(true);
  });
});
