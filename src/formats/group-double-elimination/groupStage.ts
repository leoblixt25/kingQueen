import type { Group, GroupStageMatch, Team, TeamId } from "./types";
import {
  buildGroupPlan,
  getQualifiedTeamIds,
  type GroupAllocationOptions,
} from "./groups";
import {
  generateGroupStageSchedule,
  isGroupStageComplete,
  type GroupStageRound,
} from "./groupStageMatches";
import { GroupStageError } from "./errors";

/**
 * Group-stage facade.
 *
 * Combines allocation and round-robin generation into one deterministic,
 * side-effect-free state object. Persistence is a later phase; this module
 * never touches React or Firebase.
 */
export interface GroupStageState {
  groups: Group[];
  matches: GroupStageMatch[];
  rounds: GroupStageRound[];
}

export const buildGroupStage = (
  teams: readonly Team[],
  options: GroupAllocationOptions | number
): GroupStageState => {
  const plan = buildGroupPlan(teams, options);

  if (plan.unassignedTeamIds.length > 0) {
    throw new GroupStageError(
      "unassigned-teams",
      `Cannot build a group stage with unassigned teams: ${plan.unassignedTeamIds.join(", ")}.`
    );
  }

  const schedule = generateGroupStageSchedule(plan.groups);

  return {
    groups: plan.groups,
    matches: schedule.matches,
    rounds: schedule.rounds,
  };
};

/** Every team advances, regardless of its group record. */
export const getGroupStageQualifiers = (
  stage: GroupStageState
): TeamId[] => getQualifiedTeamIds(stage.groups);

export const isGroupStageFinished = (stage: GroupStageState): boolean =>
  isGroupStageComplete(stage.matches);
