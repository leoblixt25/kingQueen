import type { Group, GroupId, Team, TeamId } from "./types";
import { compareText } from "./compare";
import { GroupStageError } from "./errors";

/**
 * Group allocation.
 *
 * Deterministic by design: teams are ordered by seed (unseeded last), then
 * name and id, and distributed snake-style so every group gets a balanced
 * spread of seeds. Explicit group sizes are supported, which is how the
 * "configurable groups and group sizes" requirement is met.
 */

export const MIN_TEAMS_PER_GROUP = 2;

export interface GroupAllocationOptions {
  /** Number of groups. Required unless `groupSizes` is provided. */
  groupCount?: number;
  /** Exact sizes per group. Must sum to the number of teams. */
  groupSizes?: readonly number[];
}

export interface GroupPlan {
  groups: Group[];
  /** Explicit team → group mapping for convenience. */
  assignments: Record<TeamId, GroupId>;
  /** Teams that could not be placed; always empty for a valid plan. */
  unassignedTeamIds: TeamId[];
}

const GROUP_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export const groupNameForIndex = (index: number): string =>
  index < GROUP_LETTERS.length
    ? `Group ${GROUP_LETTERS[index]}`
    : `Group ${index + 1}`;

const compareTeams = (a: Team, b: Team): number => {
  const aSeed = a.seed ?? Number.POSITIVE_INFINITY;
  const bSeed = b.seed ?? Number.POSITIVE_INFINITY;
  if (aSeed !== bSeed) return aSeed - bSeed;
  return compareText(a.name, b.name) || compareText(a.id, b.id);
};

const normalizeGroupCount = (options: GroupAllocationOptions): number => {
  const fromSizes = options.groupSizes?.length;
  const groupCount = options.groupCount ?? fromSizes;

  if (groupCount === undefined) {
    throw new GroupStageError(
      "invalid-group-count",
      "Provide either groupCount or explicit groupSizes."
    );
  }

  if (!Number.isInteger(groupCount) || groupCount < 1) {
    throw new GroupStageError(
      "invalid-group-count",
      `groupCount must be a positive integer, received ${groupCount}.`
    );
  }

  return groupCount;
};

const resolveGroupSizes = (
  teamCount: number,
  options: GroupAllocationOptions
): number[] => {
  const groupCount = normalizeGroupCount(options);

  if (options.groupSizes) {
    if (options.groupSizes.length !== groupCount) {
      throw new GroupStageError(
        "invalid-group-sizes",
        `groupSizes has ${options.groupSizes.length} entries but groupCount is ${groupCount}.`
      );
    }

    const sizes = [...options.groupSizes];
    const sum = sizes.reduce((total, size) => total + size, 0);
    if (sum !== teamCount) {
      throw new GroupStageError(
        "invalid-group-sizes",
        `groupSizes sums to ${sum} but there are ${teamCount} teams.`
      );
    }

    sizes.forEach((size, index) => {
      if (!Number.isInteger(size) || size < MIN_TEAMS_PER_GROUP) {
        throw new GroupStageError(
          "invalid-group-sizes",
          `Group ${index + 1} must have at least ${MIN_TEAMS_PER_GROUP} teams.`
        );
      }
    });

    return sizes;
  }

  const maxGroups = Math.floor(teamCount / MIN_TEAMS_PER_GROUP);
  if (groupCount > maxGroups) {
    throw new GroupStageError(
      "not-enough-teams",
      `${teamCount} teams cannot fill ${groupCount} groups with at least ${MIN_TEAMS_PER_GROUP} teams each.`
    );
  }

  const baseSize = Math.floor(teamCount / groupCount);
  const remainder = teamCount % groupCount;
  return Array.from({ length: groupCount }, (_, index) =>
    index < remainder ? baseSize + 1 : baseSize
  );
};

const assertUniqueTeams = (teams: readonly Team[]): void => {
  const seen = new Set<TeamId>();
  for (const team of teams) {
    if (!team.id || team.id.trim() === "") {
      throw new GroupStageError("invalid-team", "Every team needs a non-empty id.");
    }
    if (seen.has(team.id)) {
      throw new GroupStageError(
        "duplicate-team",
        `Team id "${team.id}" appears more than once.`
      );
    }
    seen.add(team.id);
  }
};

/**
 * Distributes teams into groups and returns the plan.
 *
 * Snake order for 8 teams in 2 groups: A, B, B, A, A, B, B, A.
 * The input order is irrelevant — only seed, name and id are used.
 */
export const buildGroupPlan = (
  teams: readonly Team[],
  options: GroupAllocationOptions | number
): GroupPlan => {
  const normalizedOptions: GroupAllocationOptions =
    typeof options === "number" ? { groupCount: options } : options;

  if (teams.length < MIN_TEAMS_PER_GROUP) {
    throw new GroupStageError(
      "not-enough-teams",
      `At least ${MIN_TEAMS_PER_GROUP} teams are required.`
    );
  }

  assertUniqueTeams(teams);

  const sizes = resolveGroupSizes(teams.length, normalizedOptions);
  const groups: Group[] = sizes.map((_, index) => ({
    id: `group-${index + 1}`,
    name: groupNameForIndex(index),
    teamIds: [],
  }));

  // Build the snake sequence of group indexes, respecting each capacity.
  const counts = sizes.map(() => 0);
  const sequence: number[] = [];
  let direction = 1;
  while (sequence.length < teams.length) {
    const indexes = groups.map((_, index) => index);
    if (direction === -1) indexes.reverse();

    for (const index of indexes) {
      if (sequence.length >= teams.length) break;
      if (counts[index] < sizes[index]) {
        sequence.push(index);
        counts[index] += 1;
      }
    }

    direction *= -1;
  }

  const sortedTeams = [...teams].sort(compareTeams);
  const assignments: Record<TeamId, GroupId> = {};

  sortedTeams.forEach((team, index) => {
    const group = groups[sequence[index]];
    group.teamIds.push(team.id);
    assignments[team.id] = group.id;
  });

  return { groups, assignments, unassignedTeamIds: [] };
};

/** Returns plan problems; an empty array means the plan is usable. */
export const validateGroupPlan = (plan: GroupPlan): string[] => {
  const problems: string[] = [];
  const seen = new Set<TeamId>();

  for (const group of plan.groups) {
    if (group.teamIds.length < MIN_TEAMS_PER_GROUP) {
      problems.push(
        `${group.name} has ${group.teamIds.length} teams; at least ${MIN_TEAMS_PER_GROUP} are required.`
      );
    }

    for (const teamId of group.teamIds) {
      if (seen.has(teamId)) {
        problems.push(`Team "${teamId}" appears in more than one group.`);
      }
      seen.add(teamId);
    }
  }

  if (plan.unassignedTeamIds.length > 0) {
    problems.push(
      `Unassigned teams: ${plan.unassignedTeamIds.join(", ")}.`
    );
  }

  return problems;
};

/**
 * Every team advances from the group stage. This helper exists to make that
 * format rule explicit at call sites instead of relying on an implicit
 * "no eliminations" assumption.
 */
export const getQualifiedTeamIds = (
  groups: readonly Group[]
): TeamId[] => groups.flatMap((group) => group.teamIds);
