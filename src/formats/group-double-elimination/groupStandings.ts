import type { Group, GroupId, GroupStageMatch, TeamId } from "./types";
import { compareText } from "./compare";
import { isGroupStageMatchComplete } from "./groupStageMatches";

/**
 * Group standings and tiebreakers.
 *
 * Only completed group matches count. Group results seed the elimination
 * stage, but they never eliminate a team and never count as an elimination
 * loss — every row is marked `qualified: true`.
 *
 * Tiebreaker order is configurable through `settings.groupTiebreakers`. The
 * default (and the order displayed in the rules UI) is:
 * 1. Wins
 * 2. Head-to-head among teams tied on wins (wins, then point difference)
 * 3. Mini-league point differential for 3+ way circular ties
 * 4. Overall point difference
 * 5. Points scored
 * 6. Team id (code-point order, deterministic)
 *
 * Every row records `tiebreakUsed`: the rule that actually separated it from
 * the row directly above it. Unknown or duplicated keys are ignored. `wins`
 * is always mandatory and is restored at the front so a group position can
 * never be decided before the number of wins has been compared.
 */

export type GroupTiebreaker =
  | "wins"
  | "head-to-head"
  | "mini-league-difference"
  | "point-difference"
  | "points-scored"
  | "team-id";

export const DEFAULT_GROUP_TIEBREAKERS: readonly GroupTiebreaker[] = [
  "wins",
  "head-to-head",
  "mini-league-difference",
  "point-difference",
  "points-scored",
  "team-id",
];

export const GROUP_TIEBREAKER_LABELS: Record<GroupTiebreaker, string> = {
  wins: "Wins",
  "head-to-head": "Head-to-head",
  "mini-league-difference": "Mini-league +/- (3+ way)",
  "point-difference": "Overall +/-",
  "points-scored": "Points for",
  "team-id": "Team id",
};

const VALID_TIEBREAKERS = new Set<string>(DEFAULT_GROUP_TIEBREAKERS);

/** Normalize persisted configuration into a safe, complete tiebreaker order. */
export const resolveGroupTiebreakers = (
  configured: readonly string[] | undefined
): readonly GroupTiebreaker[] => {
  const normalized: GroupTiebreaker[] = [];
  for (const key of configured ?? []) {
    if (VALID_TIEBREAKERS.has(key) && !normalized.includes(key as GroupTiebreaker)) {
      normalized.push(key as GroupTiebreaker);
    }
  }

  return [...new Set<GroupTiebreaker>(["wins", ...normalized, ...DEFAULT_GROUP_TIEBREAKERS])];
};

export interface GroupStanding {
  /** Unique position within the group, 1-based. */
  rank: number;
  teamId: TeamId;
  played: number;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  pointDifference: number;
  /** The rule that separated this row from the row above it, if any. */
  tiebreakUsed: GroupTiebreaker | null;
  /** Format rule: nobody is eliminated in the group stage. */
  qualified: true;
}

export interface GroupStandingsTable {
  groupId: GroupId;
  rows: GroupStanding[];
}

interface BaseStat {
  teamId: TeamId;
  played: number;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  pointDifference: number;
}

interface HeadToHeadStat {
  wins: number;
  pointDifference: number;
}

const createBaseStat = (teamId: TeamId): BaseStat => ({
  teamId,
  played: 0,
  wins: 0,
  losses: 0,
  pointsFor: 0,
  pointsAgainst: 0,
  pointDifference: 0,
});

const completedMatchesForGroup = (
  group: Group,
  matches: readonly GroupStageMatch[]
): GroupStageMatch[] =>
  matches.filter(
    (match) =>
      match.phase === "group" &&
      match.groupId === group.id &&
      isGroupStageMatchComplete(match)
  );

/**
 * Head-to-head record within one block of teams tied on wins. Only matches
 * where both teams belong to the block count. This keeps the comparison
 * transitive for three-way (or larger) ties: every team in the block is
 * ranked by the same set of mutual results.
 */
const buildHeadToHeadForBlock = (
  teamIds: readonly TeamId[],
  matches: readonly GroupStageMatch[]
): Map<TeamId, HeadToHeadStat> => {
  const members = new Set(teamIds);
  const stats = new Map<TeamId, HeadToHeadStat>(
    teamIds.map((teamId) => [teamId, { wins: 0, pointDifference: 0 }])
  );

  for (const match of matches) {
    if (!members.has(match.teamAId) || !members.has(match.teamBId)) continue;
    if (match.scoreA === null || match.scoreB === null) continue;

    const margin = Math.abs(match.scoreA - match.scoreB);
    const winner = match.scoreA > match.scoreB ? match.teamAId : match.teamBId;
    const loser = match.scoreA > match.scoreB ? match.teamBId : match.teamAId;
    const winnerStat = stats.get(winner);
    const loserStat = stats.get(loser);
    if (!winnerStat || !loserStat) continue;

    winnerStat.wins += 1;
    winnerStat.pointDifference += margin;
    loserStat.pointDifference -= margin;
  }

  return stats;
};

interface TiebreakDecision {
  diff: number;
  key: GroupTiebreaker | null;
}

const compareByTiebreakers = (
  a: BaseStat,
  b: BaseStat,
  headToHead: Map<TeamId, HeadToHeadStat>,
  miniLeague: Map<TeamId, number>,
  tiebreakers: readonly GroupTiebreaker[]
): TiebreakDecision => {
  for (const key of tiebreakers) {
    switch (key) {
      case "wins": {
        const diff = b.wins - a.wins;
        if (diff !== 0) return { diff, key };
        break;
      }
      case "head-to-head": {
        const aHead = headToHead.get(a.teamId);
        const bHead = headToHead.get(b.teamId);
        const winsDiff = (bHead?.wins ?? 0) - (aHead?.wins ?? 0);
        if (winsDiff !== 0) return { diff: winsDiff, key };
        const marginDiff = (bHead?.pointDifference ?? 0) - (aHead?.pointDifference ?? 0);
        if (marginDiff !== 0) return { diff: marginDiff, key };
        break;
      }
      case "mini-league-difference": {
        // Only meaningful for 3+ way ties. In a two-team tie this is the same
        // as head-to-head point difference and has already been applied.
        const diff = (miniLeague.get(b.teamId) ?? 0) - (miniLeague.get(a.teamId) ?? 0);
        if (diff !== 0) return { diff, key };
        break;
      }
      case "point-difference": {
        const diff = b.pointDifference - a.pointDifference;
        if (diff !== 0) return { diff, key };
        break;
      }
      case "points-scored": {
        const diff = b.pointsFor - a.pointsFor;
        if (diff !== 0) return { diff, key };
        break;
      }
      case "team-id": {
        const diff = compareText(a.teamId, b.teamId);
        if (diff !== 0) return { diff, key };
        break;
      }
    }
  }
  return { diff: 0, key: null };
};

/** Standings for one group; incomplete matches are ignored. */
export const calculateGroupStandings = (
  group: Group,
  matches: readonly GroupStageMatch[],
  configuredTiebreakers?: readonly string[]
): GroupStandingsTable => {
  const tiebreakers = resolveGroupTiebreakers(configuredTiebreakers);
  const stats = new Map<TeamId, BaseStat>(
    group.teamIds.map((teamId) => [teamId, createBaseStat(teamId)])
  );
  const completed = completedMatchesForGroup(group, matches);

  for (const match of completed) {
    const teamA = stats.get(match.teamAId);
    const teamB = stats.get(match.teamBId);

    // Ignore matches involving teams outside this group.
    if (!teamA || !teamB || match.scoreA === null || match.scoreB === null) {
      continue;
    }

    teamA.played += 1;
    teamB.played += 1;
    teamA.pointsFor += match.scoreA;
    teamA.pointsAgainst += match.scoreB;
    teamB.pointsFor += match.scoreB;
    teamB.pointsAgainst += match.scoreA;

    if (match.scoreA > match.scoreB) {
      teamA.wins += 1;
      teamB.losses += 1;
    } else {
      teamB.wins += 1;
      teamA.losses += 1;
    }
  }

  // Build head-to-head independently for each wins block so only teams that
  // are actually tied use it, and every team in the block shares the same
  // mutual results.
  const headToHead = new Map<TeamId, HeadToHeadStat>();
  const miniLeague = new Map<TeamId, number>();
  const winsBlocks = new Map<number, TeamId[]>();
  for (const stat of stats.values()) {
    const block = winsBlocks.get(stat.wins);
    if (block) {
      block.push(stat.teamId);
    } else {
      winsBlocks.set(stat.wins, [stat.teamId]);
    }
  }
  for (const blockTeamIds of winsBlocks.values()) {
    const blockStats = buildHeadToHeadForBlock(blockTeamIds, completed);
    for (const [teamId, headStat] of blockStats) {
      headToHead.set(teamId, headStat);
      // Mini-league point differential is the same mutual-point calculation,
      // but only applies to blocks of three or more teams.
      if (blockTeamIds.length >= 3) miniLeague.set(teamId, headStat.pointDifference);
    }
  }

  const ordered = [...stats.values()].map((stat) => {
    stat.pointDifference = stat.pointsFor - stat.pointsAgainst;
    return stat;
  });

  ordered.sort(
    (a, b) => compareByTiebreakers(a, b, headToHead, miniLeague, tiebreakers).diff
  );

  return {
    groupId: group.id,
    rows: ordered.map((stat, index) => ({
      ...stat,
      rank: index + 1,
      tiebreakUsed:
        index === 0
          ? null
          : compareByTiebreakers(
              ordered[index - 1],
              stat,
              headToHead,
              miniLeague,
              tiebreakers
            ).key,
      qualified: true as const,
    })),
  };
};

export const calculateAllGroupStandings = (
  groups: readonly Group[],
  matches: readonly GroupStageMatch[],
  configuredTiebreakers?: readonly string[]
): GroupStandingsTable[] =>
  groups.map((group) =>
    calculateGroupStandings(group, matches, configuredTiebreakers)
  );

/**
 * Cross-group elimination seeding: all group winners first, then every
 * runner-up, and so on. Ties across groups are resolved deterministically.
 * Every team appears exactly once, so all teams are qualified.
 *
 * Head-to-head is intentionally omitted here: teams in different groups never
 * played each other. The configured in-group tiebreakers have already decided
 * each `groupRank`.
 */
export const seedTeamsFromGroupStandings = (
  tables: readonly GroupStandingsTable[]
): TeamId[] => {
  const byRank = new Map<number, GroupStanding[]>();

  for (const table of tables) {
    for (const row of table.rows) {
      const block = byRank.get(row.rank);
      if (block) {
        block.push(row);
      } else {
        byRank.set(row.rank, [row]);
      }
    }
  }

  const ranks = [...byRank.keys()].sort((a, b) => a - b);

  return ranks.flatMap((rank) => {
    const block = [...(byRank.get(rank) ?? [])];
    block.sort(
      (a, b) =>
        b.wins - a.wins ||
        b.pointDifference - a.pointDifference ||
        b.pointsFor - a.pointsFor ||
        compareText(a.teamId, b.teamId)
    );
    return block.map((row) => row.teamId);
  });
};
