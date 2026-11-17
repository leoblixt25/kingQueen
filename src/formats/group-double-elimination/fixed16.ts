import type {
  Group,
  GroupId,
  GroupStageMatch,
  Team,
  TeamId,
} from "./types";
import type { GroupStageState } from "./groupStage";
import { buildGroupStage } from "./groupStage";
import {
  calculateAllGroupStandings,
  seedTeamsFromGroupStandings,
  type GroupStandingsTable,
} from "./groupStandings";
import {
  buildEliminationStage,
  type EliminationStage,
} from "./elimination";
import { applySpanishCrossover, hasSpanishCrossover } from "./spanishCrossover";
import {
  isGroupStageComplete,
  getGroupStageProgress,
} from "./groupStageMatches";
import { GroupStageError, EliminationError } from "./errors";
import type { EliminationAdvanceOptions } from "./progression";

/**
 * Fixed 16-team facade for the Group Stage + Spanish Double Elimination
 * format. This is the only module that combines the two stages; the pure
 * engines remain usable independently.
 */

export const FIXED16_TEAM_COUNT = 16;
export const FIXED16_GROUP_COUNT = 4;
export const FIXED16_TEAMS_PER_GROUP = 4;
export const FIXED16_MATCHES_PER_GROUP = 6;
export const FIXED16_GROUP_MATCH_COUNT =
  FIXED16_GROUP_COUNT * FIXED16_MATCHES_PER_GROUP;

/** Progression for this format always avoids immediate rematches. */
export const FIXED16_ADVANCE_OPTIONS: EliminationAdvanceOptions = {
  avoidRematches: true,
};

export interface GlobalRankingRow {
  /** Global group-stage rank, 1 through 16. */
  globalRank: number;
  teamId: TeamId;
  groupId: GroupId;
  groupRank: number;
  wins: number;
  losses: number;
  pointDifference: number;
}

export interface Fixed16TournamentState {
  teams: Team[];
  groupStage: GroupStageState;
  elimination: EliminationStage | null;
}

export const assertFixed16Teams = (teams: readonly Team[]): void => {
  if (teams.length !== FIXED16_TEAM_COUNT) {
    throw new GroupStageError(
      "not-enough-teams",
      `This format needs exactly ${FIXED16_TEAM_COUNT} teams, received ${teams.length}.`
    );
  }

  const seen = new Set<TeamId>();
  for (const team of teams) {
    if (!team.id || seen.has(team.id)) {
      throw new GroupStageError(
        "duplicate-team",
        `Team id "${team.id}" is empty or duplicated.`
      );
    }
    seen.add(team.id);
  }
};

export const buildFixed16GroupStage = (
  teams: readonly Team[]
): GroupStageState => {
  assertFixed16Teams(teams);
  const stage = buildGroupStage(teams, {
    groupSizes: Array.from(
      { length: FIXED16_GROUP_COUNT },
      () => FIXED16_TEAMS_PER_GROUP
    ),
  });

  if (
    stage.groups.length !== FIXED16_GROUP_COUNT ||
    stage.matches.length !== FIXED16_GROUP_MATCH_COUNT
  ) {
    throw new GroupStageError(
      "invalid-group-sizes",
      "The 16-team format requires 4 groups of 4 and 24 group matches."
    );
  }

  return stage;
};

/** Global ranking 1-16, derived only from completed group-stage results. */
export const getGlobalRanking = (
  tables: readonly GroupStandingsTable[]
): GlobalRankingRow[] => {
  const orderedTeamIds = seedTeamsFromGroupStandings(tables);
  const byTeam = new Map<TeamId, { groupId: GroupId; row: (typeof tables)[number]["rows"][number] }>();

  for (const table of tables) {
    for (const row of table.rows) {
      byTeam.set(row.teamId, { groupId: table.groupId, row });
    }
  }

  return orderedTeamIds.map((teamId, index) => {
    const entry = byTeam.get(teamId);
    if (!entry) {
      throw new GroupStageError(
        "unassigned-teams",
        `Team "${teamId}" has no group standing.`
      );
    }

    return {
      globalRank: index + 1,
      teamId,
      groupId: entry.groupId,
      groupRank: entry.row.rank,
      wins: entry.row.wins,
      losses: entry.row.losses,
      pointDifference: entry.row.pointDifference,
    };
  });
};

export const getFixed16GlobalRanking = (
  groups: readonly Group[],
  matches: readonly GroupStageMatch[]
): GlobalRankingRow[] =>
  getGlobalRanking(calculateAllGroupStandings(groups, matches));

export const canGenerateFixed16Bracket = (
  matches: readonly GroupStageMatch[]
): boolean =>
  isGroupStageComplete(matches) &&
  getGroupStageProgress(matches).total === FIXED16_GROUP_MATCH_COUNT;

/**
 * Builds the elimination stage from a completed 16-team group stage and
 * applies the mandatory Spanish semifinal crossover.
 */
export const buildFixed16EliminationStage = (
  stage: GroupStageState
): EliminationStage => {
  if (!canGenerateFixed16Bracket(stage.matches)) {
    throw new EliminationError(
      "group-stage-incomplete",
      "All 24 group matches must be complete before the bracket is generated."
    );
  }

  const elimination = buildEliminationStage(stage);
  if (elimination.seededTeamIds.length !== FIXED16_TEAM_COUNT) {
    throw new EliminationError(
      "invalid-team-count",
      "The elimination bracket must contain all 16 qualified teams."
    );
  }

  const bracket = applySpanishCrossover(elimination.bracket);
  if (!hasSpanishCrossover(bracket)) {
    throw new EliminationError(
      "invalid-bracket",
      "The Spanish semifinal crossover was not applied."
    );
  }

  return { ...elimination, bracket };
};
