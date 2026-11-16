import type { Group, GroupId, GroupStageMatch } from "./types";
import { notImplemented } from "./notImplemented";

/**
 * Group-stage match generation contract.
 *
 * The future implementation will create round-robin fixtures inside each
 * group (with BYE handling for odd group sizes). It must only run on an
 * explicit admin action — never on page load.
 */
export interface GroupStageSchedule {
  matches: GroupStageMatch[];
  roundsPerGroup: Record<GroupId, number>;
}

export const generateGroupStageSchedule = (
  _groups: readonly Group[]
): GroupStageSchedule => notImplemented("Group-stage match generation");

export const isGroupStageComplete = (
  _matches: readonly GroupStageMatch[]
): boolean => notImplemented("Group-stage completion check");
