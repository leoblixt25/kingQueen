import { describe, expect, it } from "vitest";
import type { Team } from "./types";
import {
  MIN_TEAMS_PER_GROUP,
  buildGroupPlan,
  getQualifiedTeamIds,
  groupNameForIndex,
  validateGroupPlan,
} from "./groups";
import { GroupStageError } from "./errors";

const makeTeams = (count: number, withSeeds = true): Team[] =>
  Array.from({ length: count }, (_, index) => ({
    id: `team-${String(index + 1).padStart(2, "0")}`,
    name: `Team ${String(index + 1).padStart(2, "0")}`,
    playerIds: [],
    seed: withSeeds ? index + 1 : null,
    groupId: null,
  }));

const seedsInGroup = (plan: ReturnType<typeof buildGroupPlan>, groupId: string): number[] => {
  const group = plan.groups.find((candidate) => candidate.id === groupId);
  if (!group) throw new Error(`Missing group ${groupId}`);
  return group.teamIds.map(
    (teamId) => Number(teamId.replace("team-", ""))
  );
};

const captureError = (action: () => unknown): GroupStageError => {
  try {
    action();
  } catch (error) {
    if (error instanceof GroupStageError) return error;
    throw error;
  }
  throw new Error("Expected a GroupStageError");
};

describe("group allocation", () => {
  it("splits teams evenly and names groups deterministically", () => {
    const plan = buildGroupPlan(makeTeams(8), 2);

    expect(plan.groups.map((group) => group.id)).toEqual(["group-1", "group-2"]);
    expect(plan.groups.map((group) => group.name)).toEqual(["Group A", "Group B"]);
    expect(plan.groups.map((group) => group.teamIds.length)).toEqual([4, 4]);
    expect(plan.unassignedTeamIds).toEqual([]);
    expect(Object.keys(plan.assignments)).toHaveLength(8);
  });

  it("creates the larger groups first when teams do not divide evenly", () => {
    const plan = buildGroupPlan(makeTeams(10), 3);

    expect(plan.groups.map((group) => group.teamIds.length)).toEqual([4, 3, 3]);
  });

  it("distributes seeds snake-style", () => {
    const plan = buildGroupPlan(makeTeams(8), 2);

    expect(seedsInGroup(plan, "group-1")).toEqual([1, 4, 5, 8]);
    expect(seedsInGroup(plan, "group-2")).toEqual([2, 3, 6, 7]);
  });

  it("is independent of the input order", () => {
    const teams = makeTeams(8);
    const reversed = [...teams].reverse();

    expect(buildGroupPlan(reversed, 2)).toEqual(buildGroupPlan(teams, 2));
  });

  it("supports explicit group sizes", () => {
    const plan = buildGroupPlan(makeTeams(9), { groupSizes: [4, 3, 2] });

    expect(plan.groups.map((group) => group.teamIds.length)).toEqual([4, 3, 2]);
    expect(plan.groups.map((group) => group.teamIds.length).reduce((a, b) => a + b, 0)).toBe(9);
  });

  it("accepts options and a bare group count interchangeably", () => {
    expect(buildGroupPlan(makeTeams(6), 2)).toEqual(
      buildGroupPlan(makeTeams(6), { groupCount: 2 })
    );
  });

  it("assigns every team exactly once", () => {
    const teams = makeTeams(7, false);
    const plan = buildGroupPlan(teams, 3);
    const assigned = plan.groups.flatMap((group) => group.teamIds);

    expect(new Set(assigned).size).toBe(7);
    expect([...assigned].sort()).toEqual(teams.map((team) => team.id).sort());
  });

  it("keeps all teams qualified", () => {
    const plan = buildGroupPlan(makeTeams(8), 2);
    const qualified = getQualifiedTeamIds(plan.groups);

    expect(qualified).toHaveLength(8);
    expect(new Set(qualified).size).toBe(8);
  });

  it("generates group names beyond Z safely", () => {
    expect(groupNameForIndex(0)).toBe("Group A");
    expect(groupNameForIndex(25)).toBe("Group Z");
    expect(groupNameForIndex(26)).toBe("Group 27");
  });

  it("validates the minimum group size", () => {
    const error = captureError(() =>
      buildGroupPlan(makeTeams(4), { groupSizes: [3, 1] })
    );

    expect(error.code).toBe("invalid-group-sizes");
    expect(error.message).toContain(String(MIN_TEAMS_PER_GROUP));
  });

  it("rejects too many groups for the number of teams", () => {
    const error = captureError(() => buildGroupPlan(makeTeams(6), 4));

    expect(error.code).toBe("not-enough-teams");
  });

  it("rejects fewer than two teams", () => {
    const error = captureError(() => buildGroupPlan(makeTeams(1), 1));

    expect(error.code).toBe("not-enough-teams");
  });

  it("rejects invalid group counts", () => {
    expect(captureError(() => buildGroupPlan(makeTeams(4), 0)).code).toBe(
      "invalid-group-count"
    );
    expect(captureError(() => buildGroupPlan(makeTeams(4), 1.5)).code).toBe(
      "invalid-group-count"
    );
    expect(captureError(() => buildGroupPlan(makeTeams(4), {})).code).toBe(
      "invalid-group-count"
    );
  });

  it("rejects group sizes that do not add up", () => {
    const error = captureError(() =>
      buildGroupPlan(makeTeams(8), { groupSizes: [4, 3] })
    );

    expect(error.code).toBe("invalid-group-sizes");
  });

  it("rejects duplicate team ids", () => {
    const teams = makeTeams(4);
    teams[3] = { ...teams[3], id: teams[0].id };

    const error = captureError(() => buildGroupPlan(teams, 2));

    expect(error.code).toBe("duplicate-team");
  });

  it("rejects empty team ids", () => {
    const teams = makeTeams(4);
    teams[0] = { ...teams[0], id: "  " };

    expect(captureError(() => buildGroupPlan(teams, 2)).code).toBe("invalid-team");
  });
});

describe("validateGroupPlan", () => {
  it("accepts a generated plan", () => {
    expect(validateGroupPlan(buildGroupPlan(makeTeams(8), 2))).toEqual([]);
  });

  it("reports short, duplicated and unassigned teams", () => {
    const problems = validateGroupPlan({
      groups: [
        { id: "group-1", name: "Group A", teamIds: ["a"] },
        { id: "group-2", name: "Group B", teamIds: ["a"] },
      ],
      assignments: { a: "group-2" },
      unassignedTeamIds: ["b"],
    });

    expect(problems).toHaveLength(4);
    expect(problems.some((problem) => problem.includes("Group A"))).toBe(true);
    expect(problems.some((problem) => problem.includes("Group B"))).toBe(true);
    expect(problems.some((problem) => problem.includes("more than one group"))).toBe(true);
    expect(problems.some((problem) => problem.includes("Unassigned"))).toBe(true);
  });
});
