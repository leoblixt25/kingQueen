import { describe, expect, it } from "vitest";
import type { Team } from "./types";
import {
  buildGroupStage,
  getGroupStageQualifiers,
  isGroupStageFinished,
} from "./groupStage";
import {
  applyGroupMatchScore,
  getGroupStageProgress,
} from "./groupStageMatches";
import { calculateAllGroupStandings } from "./groupStandings";
import { GroupStageError } from "./errors";

const makeTeams = (count: number): Team[] =>
  Array.from({ length: count }, (_, index) => ({
    id: `team-${index + 1}`,
    name: `Team ${index + 1}`,
    playerIds: [],
    seed: index + 1,
    groupId: null,
  }));

describe("group stage facade", () => {
  it("builds groups and a full round robin in one pure call", () => {
    const stage = buildGroupStage(makeTeams(8), 2);

    expect(stage.groups.map((group) => group.teamIds.length)).toEqual([4, 4]);
    expect(stage.matches).toHaveLength(12);
    expect(stage.rounds).toHaveLength(6);
    expect(new Set(stage.matches.map((match) => match.id)).size).toBe(12);
    expect(getGroupStageQualifiers(stage)).toHaveLength(8);
  });

  it("supports uneven groups deterministically", () => {
    const stage = buildGroupStage(makeTeams(7), 3);

    expect(stage.groups.map((group) => group.teamIds.length)).toEqual([3, 2, 2]);
    expect(stage.matches).toHaveLength(5);
    expect(getGroupStageQualifiers(stage)).toHaveLength(7);
  });

  it("is deterministic across rebuilds", () => {
    expect(buildGroupStage(makeTeams(9), { groupSizes: [3, 3, 3] })).toEqual(
      buildGroupStage(makeTeams(9), { groupSizes: [3, 3, 3] })
    );
  });

  it("detects completion after every score is entered", () => {
    const stage = buildGroupStage(makeTeams(8), 2);
    expect(isGroupStageFinished(stage)).toBe(false);

    const matches = stage.matches.map((match) =>
      applyGroupMatchScore(match, 21, 15)
    );
    const finished = { ...stage, matches };

    expect(isGroupStageFinished(finished)).toBe(true);
    expect(getGroupStageProgress(matches).isComplete).toBe(true);
  });

  it("keeps every team qualified even after losing every group match", () => {
    const teams = makeTeams(8);
    const stage = buildGroupStage(teams, 2);

    // team-8 loses all three of its group matches; everyone else plays normally.
    const matches = stage.matches.map((match) => {
      if (match.teamAId === "team-8") return applyGroupMatchScore(match, 10, 21);
      if (match.teamBId === "team-8") return applyGroupMatchScore(match, 21, 10);
      return applyGroupMatchScore(match, 21, 15);
    });

    const qualifiers = getGroupStageQualifiers({ ...stage, matches });
    const tables = calculateAllGroupStandings(stage.groups, matches);
    const loserRow = tables
      .flatMap((table) => table.rows)
      .find((row) => row.teamId === "team-8");

    expect(loserRow).toMatchObject({ wins: 0, losses: 3, qualified: true });
    expect(qualifiers).toContain("team-8");
    expect(qualifiers).toHaveLength(teams.length);
    expect(new Set(qualifiers)).toEqual(new Set(teams.map((team) => team.id)));
    expect(tables.flatMap((table) => table.rows).every((row) => row.qualified)).toBe(true);
  });

  it("propagates allocation errors", () => {
    expect(() => buildGroupStage(makeTeams(4), 3)).toThrowError(GroupStageError);
  });

  it("exposes no matches before the stage is built", () => {
    const stage = buildGroupStage(makeTeams(4), 1);

    expect(stage.matches.every((match) => match.status === "pending")).toBe(true);
    expect(stage.matches.every((match) => match.scoreA === null)).toBe(true);
  });
});
