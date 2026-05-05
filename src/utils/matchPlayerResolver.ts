import { Player, Match, ResolvedMatch } from '@/types';

/**
 * Build a players map for quick lookup by ID
 * CRITICAL: This is the SINGLE SOURCE OF TRUTH for player lookups
 */
export const buildPlayersMap = (femalePlayers: Player[], malePlayers: Player[]): Map<string, Player> => {
  console.log('🗺️ [PLAYER MAP] Building players map...');
  console.log('📊 [PLAYER MAP] Female players:', femalePlayers?.length || 0);
  console.log('📊 [PLAYER MAP] Male players:', malePlayers?.length || 0);

  const playersMap = new Map<string, Player>();

  // Add female players to map
  if (femalePlayers && femalePlayers.length > 0) {
    femalePlayers.forEach(player => {
      if (player.id) {
        playersMap.set(player.id, player);
      } else {
        console.warn('⚠️ [PLAYER MAP] Female player missing ID:', player);
      }
    });
  }

  // Add male players to map
  if (malePlayers && malePlayers.length > 0) {
    malePlayers.forEach(player => {
      if (player.id) {
        playersMap.set(player.id, player);
      } else {
        console.warn('⚠️ [PLAYER MAP] Male player missing ID:', player);
      }
    });
  }

  console.log('✅ [PLAYER MAP] Total players in map:', playersMap.size);
  return playersMap;
};

/**
 * Resolve a player ID to player data using the players map
 * CRITICAL: Returns null if player not found - NO FALLBACK PLACEHOLDERS
 *
 * @param playerId - The player ID from match data
 * @param playersMap - Map of player IDs to Player objects (SINGLE SOURCE OF TRUTH)
 * @returns Player object or null if not found
 */
export const resolvePlayer = (
  playerId: string | null | undefined,
  playersMap: Map<string, Player>
): Player | null => {
  // Validate playerId exists
  if (!playerId) {
    console.warn(`⚠️ [PLAYER RESOLVE] Missing player ID`);
    return null;
  }

  // CRITICAL: Only use map lookup, never array index
  const player = playersMap.get(playerId);

  if (player) {
    return player;
  }

  // ID not found - this is a DATA INCONSISTENCY
  console.error(`❌ [PLAYER RESOLVE] Player ID "${playerId}" NOT FOUND in player map`);
  console.error(`📊 [PLAYER RESOLVE] Map size: ${playersMap.size}`);

  return null;
};

/**
 * Convert matches with player ID arrays to matches with full player data
 * CRITICAL: Uses playerMap for ALL lookups - NO FALLBACK PLACEHOLDERS EVER
 *
 * Standard match format:
 * {
 *   id,
 *   match_number,
 *   teamA: [playerId1, playerId2],
 *   teamB: [playerId3, playerId4],
 *   score1,
 *   score2,
 *   isSubmitted
 * }
 */
export const resolveMatchPlayers = (
  matches: Match[],
  playersMap: Map<string, Player>
): ResolvedMatch[] => {
  console.log('🔄 [MATCH RESOLVE] Resolving player IDs for', matches.length, 'matches...');

  if (!matches || matches.length === 0) {
    console.log('ℹ️ [MATCH RESOLVE] No matches to resolve');
    return [];
  }

  // Track missing IDs for summary
  const missingIds = new Set<string>();
  const problematicMatches: number[] = [];

  const resolvedMatches = matches.map((match, matchIndex) => {
    const matchNum = match.match_number || (matchIndex + 1);

    // Extract player IDs from team arrays
    const [teamA1_id, teamA2_id] = match.teamA || [null, null];
    const [teamB1_id, teamB2_id] = match.teamB || [null, null];

    // Resolve each player ID - NO PLACEHOLDERS, returns null if not found
    const teamA1 = resolvePlayer(teamA1_id, playersMap);
    const teamA2 = resolvePlayer(teamA2_id, playersMap);
    const teamB1 = resolvePlayer(teamB1_id, playersMap);
    const teamB2 = resolvePlayer(teamB2_id, playersMap);

    // Track any missing players
    const missingInMatch: string[] = [];
    if (!teamA1) missingInMatch.push(teamA1_id || 'null');
    if (!teamA2) missingInMatch.push(teamA2_id || 'null');
    if (!teamB1) missingInMatch.push(teamB1_id || 'null');
    if (!teamB2) missingInMatch.push(teamB2_id || 'null');

    if (missingInMatch.length > 0) {
      missingInMatch.forEach(id => missingIds.add(id));
      problematicMatches.push(matchNum);
      console.error(`❌ [MATCH RESOLVE] Match #${matchNum} has ${missingInMatch.length} unresolved players:`, missingInMatch);
    }

    // Only log first match and any problematic matches
    if (matchIndex === 0 || missingInMatch.length > 0) {
      console.log(`📄 [MATCH RESOLVE] Match #${matchNum}:`, {
        teamA: `${teamA1?.name || '❌'} & ${teamA2?.name || '❌'}`,
        teamB: `${teamB1?.name || '❌'} & ${teamB2?.name || '❌'}`
      });
    }

    // Build resolved match - if any player is null, the match data is incomplete
    // This ensures we NEVER show placeholder names
    return {
      id: match.id,
      match_number: matchNum,
      teamA: [teamA1, teamA2] as [Player, Player],
      teamB: [teamB1, teamB2] as [Player, Player],
      score1: match.score1 || 0,
      score2: match.score2 || 0,
      isSubmitted: match.isSubmitted || false,
      gender: match.gender
    };
  });

  // Report missing IDs summary
  if (missingIds.size > 0) {
    console.error(`❌ [MATCH RESOLVE] ${missingIds.size} player IDs not found in map:`);
    console.error(`📋 [MATCH RESOLVE] Missing IDs:`, Array.from(missingIds).slice(0, 10));
    console.error(`💡 [MATCH RESOLVE] This indicates stale match data - matches have old player IDs`);
    console.error(`⚠️ [MATCH RESOLVE] Problematic matches:`, problematicMatches);
  }

  console.log('✅ [MATCH RESOLVE] Successfully resolved', resolvedMatches.length, 'matches');
  return resolvedMatches;
};

/**
 * Convert old format matches (player1_id, player2_id, etc.) to new teamA/teamB format
 * This is a migration helper for backward compatibility
 */
export const migrateMatchFormat = (oldMatch: any): Match | null => {
  if (!oldMatch) return null;

  // Already in new format
  if (oldMatch.teamA && oldMatch.teamB) {
    return oldMatch as Match;
  }

  // Convert from old format
  if (oldMatch.player1_id || oldMatch.player2_id || oldMatch.player3_id || oldMatch.player4_id) {
    return {
      id: oldMatch.id,
      match_number: oldMatch.match_number || 0,
      gender: oldMatch.gender,
      teamA: [oldMatch.player1_id, oldMatch.player2_id] as [string, string],
      teamB: [oldMatch.player3_id, oldMatch.player4_id] as [string, string],
      score1: oldMatch.score1 || 0,
      score2: oldMatch.score2 || 0,
      isSubmitted: oldMatch.isSubmitted || oldMatch.is_completed || false
    };
  }

  return null;
};
