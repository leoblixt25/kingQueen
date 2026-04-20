import { Player, Match } from '@/types';

/**
 * Deterministic tiebreaker system for player rankings
 * Ensures unique ranking order with no shared positions
 * 
 * Tiebreaker order:
 * 1. Total points (highest first)
 * 2. Total score (highest first)
 * 3. Point differential (scored - conceded, highest first)
 * 4. Head-to-head (wins, then score difference)
 * 5. Strength of opponents (sum of opponents' points)
 * 6. Final fallback: player ID (lexicographically smallest)
 */

interface PlayerStats {
  playerId: string;
  points: number;
  totalScores: number;
  pointDifferential: number;
  strengthOfOpponents: number;
}

/**
 * Calculate point differential for a player
 */
const calculatePointDifferential = (
  playerId: string,
  matches: Match[]
): number => {
  let scored = 0;
  let conceded = 0;

  matches.forEach(match => {
    const isTeam1 = match.player1.id === playerId || match.player2.id === playerId;
    const isTeam2 = match.player3.id === playerId || match.player4.id === playerId;

    if (isTeam1) {
      scored += match.score1;
      conceded += match.score2;
    } else if (isTeam2) {
      scored += match.score2;
      conceded += match.score1;
    }
  });

  return scored - conceded;
};

/**
 * Calculate head-to-head record between two players
 */
const getHeadToHeadStats = (
  player1Id: string,
  player2Id: string,
  matches: Match[]
): { wins: number; scoreDiff: number } => {
  let wins = 0;
  let scoreDiff = 0;

  matches.forEach(match => {
    const p1InTeam1 = match.player1.id === player1Id || match.player2.id === player1Id;
    const p2InTeam1 = match.player1.id === player2Id || match.player2.id === player2Id;
    const p1InTeam2 = match.player3.id === player1Id || match.player4.id === player1Id;
    const p2InTeam2 = match.player3.id === player2Id || match.player4.id === player2Id;

    // Only consider matches where they faced each other
    if ((p1InTeam1 && p2InTeam2) || (p1InTeam2 && p2InTeam1)) {
      const p1Score = p1InTeam1 ? match.score1 : match.score2;
      const p2Score = p2InTeam1 ? match.score1 : match.score2;

      if (p1Score > p2Score) {
        wins += 1;
      }
      scoreDiff += (p1Score - p2Score);
    }
  });

  return { wins, scoreDiff };
};

/**
 * Calculate strength of opponents for a player
 */
const calculateStrengthOfOpponents = (
  playerId: string,
  matches: Match[],
  playerPointsMap: Map<string, number>
): number => {
  const opponentIds = new Set<string>();

  matches.forEach(match => {
    const isTeam1 = match.player1.id === playerId || match.player2.id === playerId;
    const isTeam2 = match.player3.id === playerId || match.player4.id === playerId;

    if (isTeam1) {
      opponentIds.add(match.player3.id || '');
      opponentIds.add(match.player4.id || '');
    } else if (isTeam2) {
      opponentIds.add(match.player1.id || '');
      opponentIds.add(match.player2.id || '');
    }
  });

  // Remove self if present
  opponentIds.delete(playerId);

  // Sum up points of all opponents
  let totalOpponentPoints = 0;
  opponentIds.forEach(oppId => {
    totalOpponentPoints += playerPointsMap.get(oppId) || 0;
  });

  return totalOpponentPoints;
};

/**
 * Compare two players using the complete tiebreaker system
 * Returns negative if a should rank higher, positive if b should rank higher
 */
export const comparePlayers = (
  a: Player,
  b: Player,
  matches: Match[],
  playerPointsMap: Map<string, number>
): number => {
  // 1. Total points (highest first)
  if (b.points !== a.points) {
    return b.points - a.points;
  }

  // 2. Total score (highest first)
  if (b.totalScores !== a.totalScores) {
    return b.totalScores - a.totalScores;
  }

  // 3. Point differential (highest first)
  const aDiff = calculatePointDifferential(a.id || '', matches);
  const bDiff = calculatePointDifferential(b.id || '', matches);
  if (bDiff !== aDiff) {
    return bDiff - aDiff;
  }

  // 4. Head-to-head
  const h2h = getHeadToHeadStats(a.id || '', b.id || '', matches);
  if (h2h.wins !== 0) {
    // If a has more wins against b, a ranks higher (return negative)
    // If b has more wins against a, b ranks higher (return positive)
    // h2h.wins is from a's perspective
    return h2h.wins > 0 ? -1 : 1;
  }
  if (h2h.scoreDiff !== 0) {
    return h2h.scoreDiff > 0 ? -1 : 1;
  }

  // 5. Strength of opponents (highest first)
  const aStrength = calculateStrengthOfOpponents(a.id || '', matches, playerPointsMap);
  const bStrength = calculateStrengthOfOpponents(b.id || '', matches, playerPointsMap);
  if (bStrength !== aStrength) {
    return bStrength - aStrength;
  }

  // 6. Final fallback: player ID (lexicographically smallest wins)
  const aId = a.id || '';
  const bId = b.id || '';
  return aId.localeCompare(bId);
};

/**
 * Sort players with deterministic tiebreaking
 * Returns a new sorted array
 */
export const sortPlayersWithTiebreakers = (
  players: Player[],
  matches: Match[]
): Player[] => {
  // Build a map of player points for strength of opponents calculation
  const playerPointsMap = new Map<string, number>();
  players.forEach(p => {
    if (p.id) {
      playerPointsMap.set(p.id, p.points);
    }
  });

  // Sort using the complete tiebreaker system
  return [...players].sort((a, b) => 
    comparePlayers(a, b, matches, playerPointsMap)
  );
};
