import type {
  Group,
  GroupId,
  GroupStageMatch,
  TeamId,
} from "./types";
import { notImplemented } from "./notImplemented";

/**
 * Group standings contract.
 *
 * Group results only decide the elimination seeding. They must never be read
 * by the elimination loss counters, which start at zero for every team.
 */
export interface GroupStanding {
  rank: number;
  teamId: TeamId;
  played: number;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  pointDifference: number;
}

export interface GroupStandingsTable {
  groupId: GroupId;
  rows: GroupStanding[];
}

export const calculateGroupStandings = (
  _group: Group,
  _matches: readonly GroupStageMatch[]
): GroupStandingsTable => notImplemented("Group standings calculation");

/**
 * Cross-group seeding: all group winners first, then all runners-up, and so
 * on. Exact tiebreakers belong to the future standings engine.
 */
export const seedTeamsFromGroupStandings = (
  _tables: readonly GroupStandingsTable[]
): TeamId[] => notImplemented("Elimination seeding from group standings");
