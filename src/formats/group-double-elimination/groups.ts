import type { Group, Team, TeamId } from "./types";
import { notImplemented } from "./notImplemented";

/**
 * Group management contract.
 *
 * Group allocation is intentionally not implemented in Phase 2. The future
 * engine will distribute teams across the configured group count and handle
 * odd group sizes without ever eliminating a team in the group stage.
 */
export interface GroupPlan {
  groups: Group[];
  /** Teams that could not be placed; must be empty before the stage starts. */
  unassignedTeamIds: TeamId[];
}

export const buildGroupPlan = (
  _teams: readonly Team[],
  _groupCount: number
): GroupPlan => notImplemented("Group allocation");

export const validateGroupPlan = (_plan: GroupPlan): string[] =>
  notImplemented("Group plan validation");
