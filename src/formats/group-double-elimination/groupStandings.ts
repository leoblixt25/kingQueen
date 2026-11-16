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
 * Tiebreaker order:
 * 1. Wins
 * 2. Head-to-head among teams tied on wins (wins, then point difference)
 * 3. Overall point difference
 * 4. Points scored
 * 5. Team id (code-point order, deterministic)
 */

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

const buildHeadToHead = (
  teamIds: readonly TeamId[],
  matches: readonly GroupStageMatch[]
): Map<TeamId, HeadToHeadStat> => {
  const ids = new Set(teamIds);
  const stats = new Map<TeamId, HeadToHeadStat>(
    teamIds.map((teamId) => [teamId, { wins: 0, pointDifference: 0 }])
  );

  for (const match of matches) {
    if (!ids.has(match.teamAId) || !ids.has(match.teamBId)) continue;

    const teamA = stats.get(match.teamAId);
    const teamB = stats.get(match.teamBId);
    if (!teamA || !teamB || match.scoreA === null || match.scoreB === null) {
      continue;
    }

    const margin = Math.abs(match.scoreA - match.scoreB);
    const teamAWon = match.scoreA > match.scoreB;
    const winner = teamAWon ? teamA : teamB;
    const loser = teamAWon ? teamB : teamA;

    winner.wins += 1;
    winner.pointDifference += margin;
    loser.pointDifference -= margin;
  }

  return stats;
};

/** Standings for one group; incomplete matches are ignored. */
export const calculateGroupStandings = (
  group: Group,
  matches: readonly GroupStageMatch[]
): GroupStandingsTable => {
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

  const byWins = new Map<number, BaseStat[]>();
  for (const stat of stats.values()) {
    stat.pointDifference = stat.pointsFor - stat.pointsAgainst;
    const block = byWins.get(stat.wins);
    if (block) {
      block.push(stat);
    } else {
      byWins.set(stat.wins, [stat]);
    }
  }

  const ordered: BaseStat[] = [];
  const winCounts = [...byWins.keys()].sort((a, b) => b - a);

  for (const wins of winCounts) {
    const block = byWins.get(wins) ?? [];

    if (block.length > 1) {
      const headToHead = buildHeadToHead(
        block.map((stat) => stat.teamId),
        completed
      );

      block.sort((a, b) => {
        const aHead = headToHead.get(a.teamId);
        const bHead = headToHead.get(b.teamId);

        return (
          (bHead?.wins ?? 0) - (aHead?.wins ?? 0) ||
          (bHead?.pointDifference ?? 0) - (aHead?.pointDifference ?? 0) ||
          b.pointDifference - a.pointDifference ||
          b.pointsFor - a.pointsFor ||
          compareText(a.teamId, b.teamId)
        );
      });
    }

    ordered.push(...block);
  }

  return {
    groupId: group.id,
    rows: ordered.map((stat, index) => ({
      ...stat,
      rank: index + 1,
      qualified: true as const,
    })),
  };
};

export const calculateAllGroupStandings = (
  groups: readonly Group[],
  matches: readonly GroupStageMatch[]
): GroupStandingsTable[] =>
  groups.map((group) => calculateGroupStandings(group, matches));

/**
 * Cross-group elimination seeding: all group winners first, then every
 * runner-up, and so on. Ties across groups are resolved deterministically.
 * Every team appears exactly once, so all teams are qualified.
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
