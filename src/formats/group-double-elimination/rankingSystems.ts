import type { GsdeTournamentDocument } from "./persistence";
import {
  calculateAllGroupStandings,
  type GroupStandingsTable,
} from "./groupStandings";
import { getGlobalRanking, type GlobalRankingRow } from "./fixed16";
import {
  calculateEliminationStandings,
  calculateFinalPlacements,
  type EliminationStanding,
  type FinalPlacement,
} from "./eliminationStandings";
import { getEliminationChampion } from "./progression";
import type { TeamId } from "./types";

/**
 * Two INDEPENDENT ranking systems.
 *
 * Group standings/ranking are derived only from group matches. Elimination
 * standings/final placements are derived only from elimination matches. There
 * is deliberately no combined "total ranking" that mixes group wins/losses
 * with elimination wins/losses.
 */

export const GROUP_RANKING_SYSTEM = {
  id: "group",
  label: "Group standings",
  source: "Group-stage matches only",
  measures: ["Wins", "Losses", "Points", "Point difference", "Tiebreakers", "Final group position"],
} as const;

export const ELIMINATION_RANKING_SYSTEM = {
  id: "elimination",
  label: "Elimination standings",
  source: "Elimination matches only",
  measures: [
    "Winners bracket progression",
    "Losers bracket progression",
    "Elimination losses",
    "Eliminated teams",
    "Final placements",
    "Champion and runner-up",
  ],
} as const;

export interface GroupRankingSystem {
  definition: typeof GROUP_RANKING_SYSTEM;
  tables: GroupStandingsTable[];
  global: GlobalRankingRow[];
}

export interface EliminationRankingSystem {
  definition: typeof ELIMINATION_RANKING_SYSTEM;
  standings: EliminationStanding[];
  placements: FinalPlacement[];
  championTeamId: TeamId | null;
  runnerUpTeamIds: TeamId[];
}

export interface RankingSystems {
  group: GroupRankingSystem;
  elimination: EliminationRankingSystem;
}

const tablesFor = (doc: GsdeTournamentDocument): GroupStandingsTable[] =>
  calculateAllGroupStandings(doc.groups, doc.matches);

/**
 * Build both ranking systems from their own sources. Changing group scores can
 * only change `group`; changing elimination results can only change
 * `elimination`.
 */
export const selectRankingSystems = (
  doc: GsdeTournamentDocument
): RankingSystems => {
  const tables = tablesFor(doc);
  const bracket = doc.elimination;

  return {
    group: {
      definition: GROUP_RANKING_SYSTEM,
      tables,
      global: getGlobalRanking(tables),
    },
    elimination: {
      definition: ELIMINATION_RANKING_SYSTEM,
      standings: bracket ? calculateEliminationStandings(bracket) : [],
      placements: bracket ? calculateFinalPlacements(bracket) : [],
      championTeamId: bracket ? getEliminationChampion(bracket) : null,
      runnerUpTeamIds: bracket
        ? (calculateFinalPlacements(bracket).find((placement) => placement.place === 2)?.teamIds ?? [])
        : [],
    },
  };
};

/** Group wins/losses for a team — never includes elimination matches. */
export const selectGroupRecord = (
  doc: GsdeTournamentDocument,
  teamId: TeamId
): { wins: number; losses: number } => {
  const tables = tablesFor(doc);
  for (const table of tables) {
    const row = table.rows.find((item) => item.teamId === teamId);
    if (row) return { wins: row.wins, losses: row.losses };
  }
  return { wins: 0, losses: 0 };
};

/** Elimination wins/losses for a team — never includes group matches. */
export const selectEliminationRecord = (
  doc: GsdeTournamentDocument,
  teamId: TeamId
): { wins: number; losses: number } => {
  if (!doc.elimination) return { wins: 0, losses: 0 };
  const row = calculateEliminationStandings(doc.elimination).find(
    (item) => item.teamId === teamId
  );
  return { wins: row?.wins ?? 0, losses: row?.losses ?? 0 };
};
