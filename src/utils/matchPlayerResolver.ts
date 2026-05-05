import { Player, Match } from '@/types';

/**
 * Build a players map for quick lookup by ID
 * CRITICAL: This is the SINGLE SOURCE OF TRUTH for player lookups
 */
export const buildPlayersMap = (femalePlayers: Player[], malePlayers: Player[]) => {
  console.log('🗺️ [PLAYER MAP] Building players map...');
  console.log('📊 [PLAYER MAP] Female players:', femalePlayers?.length || 0);
  console.log('📊 [PLAYER MAP] Male players:', malePlayers?.length || 0);
  
  // Log all player IDs for debugging
  if (femalePlayers?.length > 0) {
    console.log('📋 [PLAYER MAP] Female player IDs:', femalePlayers.map(p => p.id).join(', '));
  }
  if (malePlayers?.length > 0) {
    console.log('📋 [PLAYER MAP] Male player IDs:', malePlayers.map(p => p.id).join(', '));
  }
  
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
 * CRITICAL: Must only use playerMap lookup, never array index
 * 
 * @param playerId - The player ID from match data
 * @param playersMap - Map of player IDs to Player objects (SINGLE SOURCE OF TRUTH)
 * @param defaultName - Fallback name if player not found (should be descriptive like "TBD" or position)
 * @returns Player object
 */
export const resolvePlayer = (
  playerId: string | null | undefined, 
  playersMap: Map<string, Player>, 
  defaultName: string = 'TBD'
): Player => {
  // Validate playerId exists
  if (!playerId) {
    console.warn(`⚠️ [PLAYER RESOLVE] Missing player ID, using default "${defaultName}"`);
    return {
      id: `missing-${Date.now()}`,
      name: defaultName,
      points: 0,
      totalScores: 0
    };
  }
  
  // CRITICAL: Only use map lookup, never array index
  const player = playersMap.get(playerId);
  
  if (player) {
    return player;
  }
  
  // ID not found - this is a DATA INCONSISTENCY
  // Log available IDs to help diagnose
  const availableIds = Array.from(playersMap.keys()).slice(0, 5).join(', ') + '...';
  console.error(`❌ [PLAYER RESOLVE] Player ID "${playerId}" NOT FOUND in player map`);
  console.error(`📋 [PLAYER RESOLVE] Available IDs (first 5): ${availableIds}`);
  console.error(`📊 [PLAYER RESOLVE] Map size: ${playersMap.size}`);
  
  return {
    id: playerId,
    name: defaultName,
    points: 0,
    totalScores: 0
  };
};

/**
 * Convert matches with player IDs to matches with full player data
 * CRITICAL: Uses playerMap for ALL lookups - never uses array index
 */
export const resolveMatchPlayers = (
  matches: any[], 
  playersMap: Map<string, Player>
): Match[] => {
  console.log('🔄 [MATCH RESOLVE] Resolving player IDs for', matches.length, 'matches...');
  
  if (!matches || matches.length === 0) {
    console.log('ℹ️ [MATCH RESOLVE] No matches to resolve');
    return [];
  }
  
  // Track missing IDs for summary
  const missingIds = new Set<string>();
  
  const resolvedMatches = matches.map((match, matchIndex) => {
    // Extract player IDs from match data
    const player1_id = match.player1_id;
    const player2_id = match.player2_id;
    const player3_id = match.player3_id;
    const player4_id = match.player4_id;
    
    const matchNum = match.match_number || (matchIndex + 1);
    
    // Validate all player IDs exist in map BEFORE resolving
    [player1_id, player2_id, player3_id, player4_id].forEach((id, idx) => {
      if (id && !playersMap.has(id)) {
        missingIds.add(id);
      }
    });
    
    // Resolve each player ID to player data using ONLY map lookup
    const player1 = resolvePlayer(player1_id, playersMap, 'Team A P1');
    const player2 = resolvePlayer(player2_id, playersMap, 'Team A P2');
    const player3 = resolvePlayer(player3_id, playersMap, 'Team B P1');
    const player4 = resolvePlayer(player4_id, playersMap, 'Team B P2');
    
    // Only log first match and any problematic matches
    if (matchIndex === 0 || missingIds.has(player1_id) || missingIds.has(player2_id) || 
        missingIds.has(player3_id) || missingIds.has(player4_id)) {
      console.log(`📄 [MATCH RESOLVE] Match #${matchNum}:`, {
        player1: `${player1_id?.substring(0, 8) || 'null'}... → ${player1.name}`,
        player2: `${player2_id?.substring(0, 8) || 'null'}... → ${player2.name}`,
        player3: `${player3_id?.substring(0, 8) || 'null'}... → ${player3.name}`,
        player4: `${player4_id?.substring(0, 8) || 'null'}... → ${player4.name}`
      });
    }
    
    return {
      id: match.id,
      match_number: matchNum,
      player1,
      player2,
      player3,
      player4,
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
  }
  
  console.log('✅ [MATCH RESOLVE] Successfully resolved', resolvedMatches.length, 'matches');
  return resolvedMatches;
};

/**
 * Complete function to load and resolve matches with player data
 */
export const loadAndResolveMatches = async (
  loadMatchesFn: () => Promise<{ femaleMatches: any[]; maleMatches: any[] }>,
  femalePlayers: Player[],
  malePlayers: Player[]
) => {
  console.log('🚀 [MATCH LOAD+] Loading and resolving matches...');
  
  // Step 1: Load raw matches (with IDs only)
  const rawMatches = await loadMatchesFn();
  console.log('📊 [MATCH LOAD+] Raw matches loaded - Female:', rawMatches.femaleMatches.length, 'Male:', rawMatches.maleMatches.length);
  
  // Step 2: Build players map
  const playersMap = buildPlayersMap(femalePlayers, malePlayers);
  
  // Step 3: Resolve female matches
  const resolvedFemaleMatches = resolveMatchPlayers(rawMatches.femaleMatches, playersMap);
  console.log('✅ [MATCH LOAD+] Female matches resolved:', resolvedFemaleMatches.length);
  
  // Step 4: Resolve male matches
  const resolvedMaleMatches = resolveMatchPlayers(rawMatches.maleMatches, playersMap);
  console.log('✅ [MATCH LOAD+] Male matches resolved:', resolvedMaleMatches.length);
  
  return {
    femaleMatches: resolvedFemaleMatches,
    maleMatches: resolvedMaleMatches
  };
};
