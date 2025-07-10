import { Player, RankingEntry } from '@/types';
import { SCORING } from '@/lib/constants';

/**
 * Calculate rankings from player data
 * Rankings are sorted by: points (desc), total_scores (desc), name (asc)
 */
export function calculateRankings(players: Player[]): RankingEntry[] {
  return players
    .map((player, index) => ({
      rank: 0, // Will be calculated after sorting
      player,
      points: player.points,
      total_scores: player.total_scores,
      matches_played: player.matches_played,
    }))
    .sort((a, b) => {
      // Sort by points (descending)
      if (a.points !== b.points) {
        return b.points - a.points;
      }
      // If points are equal, sort by total scores (descending)
      if (a.total_scores !== b.total_scores) {
        return b.total_scores - a.total_scores;
      }
      // If everything is equal, sort by name (ascending)
      return a.player.name.localeCompare(b.player.name);
    })
    .map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }));
}

/**
 * Get the top players for final match
 * Returns: [1st, 2nd] for each gender
 */
export function getTopPlayers(rankings: { male: RankingEntry[]; female: RankingEntry[] }) {
  const topMales = rankings.male.slice(0, 2);
  const topFemales = rankings.female.slice(0, 2);
  
  return {
    males: topMales,
    females: topFemales,
    // Final match teams: King + Princess vs Queen + Prince
    team1: {
      male: topMales[0]?.player, // King
      female: topFemales[1]?.player, // Princess
    },
    team2: {
      female: topFemales[0]?.player, // Queen  
      male: topMales[1]?.player, // Prince
    },
  };
}

/**
 * Calculate points for a match result
 */
export function calculateMatchPoints(score1: number, score2: number) {
  const winnerPoints = SCORING.WINNER_POINTS;
  const loserPoints = SCORING.LOSER_POINTS;
  
  if (score1 > score2) {
    return {
      team1Points: winnerPoints,
      team2Points: loserPoints,
    };
  } else {
    return {
      team1Points: loserPoints,
      team2Points: winnerPoints,
    };
  }
}

/**
 * Validate score input
 */
export function validateScore(score: string | number): boolean {
  const numScore = typeof score === 'string' ? parseInt(score, 10) : score;
  return !isNaN(numScore) && numScore >= 0 && numScore <= 999;
}

/**
 * Format player stats for display
 */
export function formatPlayerStats(player: Player) {
  return {
    name: player.name,
    points: player.points,
    totalScores: player.total_scores,
    matchesPlayed: player.matches_played,
    avgScore: player.matches_played > 0 ? (player.total_scores / player.matches_played).toFixed(1) : '0.0',
  };
}