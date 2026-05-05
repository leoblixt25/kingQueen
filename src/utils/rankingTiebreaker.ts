import { Player, Match, ResolvedMatch } from '@/types';

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

// Helper to get player ID safely - works with both Player objects and string IDs
const getPlayerId = (player: Player | string | null): string => {
  if (typeof player === 'string') return player;
  return player?.id || '';
};

/**
 * Calculate point differential for a player
 */
const calculatePointDifferential = (
  playerId: string,
  matches: Match[] | ResolvedMatch[]
): number => {
  let scored = 0;
  let conceded = 0;

  matches.forEach(match => {
    const [teamA1, teamA2] = match.teamA;
    const [teamB1, teamB2] = match.teamB;

    const isTeamA = getPlayerId(teamA1) === playerId || getPlayerId(teamA2) === playerId;
    const isTeamB = getPlayerId(teamB1) === playerId || getPlayerId(teamB2) === playerId;

    if (isTeamA) {
      scored += match.score1;
      conceded += match.score2;
    } else if (isTeamB) {
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
  matches: Match[] | ResolvedMatch[]
): { wins: number; scoreDiff: number } => {
  let wins = 0;
  let scoreDiff = 0;

  matches.forEach(match => {
    const [teamA1, teamA2] = match.teamA;
    const [teamB1, teamB2] = match.teamB;

    const p1InTeamA = getPlayerId(teamA1) === player1Id || getPlayerId(teamA2) === player1Id;
    const p2InTeamA = getPlayerId(teamA1) === player2Id || getPlayerId(teamA2) === player2Id;
    const p1InTeamB = getPlayerId(teamB1) === player1Id || getPlayerId(teamB2) === player1Id;
    const p2InTeamB = getPlayerId(teamB1) === player2Id || getPlayerId(teamB2) === player2Id;

    // Only consider matches where they faced each other
    if ((p1InTeamA && p2InTeamB) || (p1InTeamB && p2InTeamA)) {
      const p1Score = p1InTeamA ? match.score1 : match.score2;
      const p2Score = p2InTeamA ? match.score1 : match.score2;

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
  matches: Match[] | ResolvedMatch[],
  playerPointsMap: Map<string, number>
): number => {
  const opponentIds = new Set<string>();

  matches.forEach(match => {
    const [teamA1, teamA2] = match.teamA;
    const [teamB1, teamB2] = match.teamB;

    const isTeamA = getPlayerId(teamA1) === playerId || getPlayerId(teamA2) === playerId;
    const isTeamB = getPlayerId(teamB1) === playerId || getPlayerId(teamB2) === playerId;

    if (isTeamA) {
      opponentIds.add(getPlayerId(teamB1));
      opponentIds.add(getPlayerId(teamB2));
    } else if (isTeamB) {
      opponentIds.add(getPlayerId(teamA1));
      opponentIds.add(getPlayerId(teamA2));
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
 * Get the tiebreaker level that determined the ranking between two players
 * Returns the level name or null if no tiebreaker was needed
 */
export const getTiebreakerLevel = (
  a: Player,
  b: Player,
  matches: Match[] | ResolvedMatch[],
  playerPointsMap: Map<string, number>
): string | null => {
  // If points are different, no tiebreaker needed
  if (b.points !== a.points) {
    return null;
  }

  // Points are tied, check tiebreakers
  // 1. Total score
  if (b.totalScores !== a.totalScores) {
    return 'Score';
  }

  // 2. Point differential
  const aDiff = calculatePointDifferential(a.id || '', matches);
  const bDiff = calculatePointDifferential(b.id || '', matches);
  if (bDiff !== aDiff) {
    return 'Difference';
  }

  // 3. Head-to-head
  const h2h = getHeadToHeadStats(a.id || '', b.id || '', matches);
  if (h2h.wins !== 0) {
    return 'Head-to-head';
  }
  if (h2h.scoreDiff !== 0) {
    return 'Head-to-head';
  }

  // 4. Strength of opponents
  const aStrength = calculateStrengthOfOpponents(a.id || '', matches, playerPointsMap);
  const bStrength = calculateStrengthOfOpponents(b.id || '', matches, playerPointsMap);
  if (bStrength !== aStrength) {
    return 'Opponents';
  }

  // 5. Final rule (player ID)
  return 'Final rule';
};

/**
 * Compare two players using the complete tiebreaker system
 * Returns negative if a should rank higher, positive if b should rank higher
 */
export const comparePlayers = (
  a: Player,
  b: Player,
  matches: Match[] | ResolvedMatch[],
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
  matches: Match[] | ResolvedMatch[]
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
