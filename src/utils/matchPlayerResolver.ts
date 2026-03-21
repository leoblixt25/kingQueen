import { Player, Match } from '@/types';

/**
 * Build a players map for quick lookup by ID
 */
export const buildPlayersMap = (femalePlayers: Player[], malePlayers: Player[]) => {
  console.log('🗺️ [PLAYER MAP] Building players map...');
  console.log('📊 [PLAYER MAP] Female players:', femalePlayers?.length || 0);
  console.log('📊 [PLAYER MAP] Male players:', malePlayers?.length || 0);
  
  const playersMap = new Map<string, Player>();
  
  // Add female players to map
  if (femalePlayers && femalePlayers.length > 0) {
    femalePlayers.forEach(player => {
      if (player.id) {
        playersMap.set(player.id, player);
      }
    });
  }
  
  // Add male players to map
  if (malePlayers && malePlayers.length > 0) {
    malePlayers.forEach(player => {
      if (player.id) {
        playersMap.set(player.id, player);
      }
    });
  }
  
  console.log('✅ [PLAYER MAP] Total players in map:', playersMap.size);
  return playersMap;
};

/**
 * Resolve a player ID to player data using the players map
 * Falls back to placeholder names if player not found
 */
export const resolvePlayer = (playerId: string | null | undefined, playersMap: Map<string, Player>, index: number): Player => {
  if (!playerId) {
    // Return placeholder if no ID
    return {
      id: `placeholder-${index}`,
      name: `Player ${index}`,
      points: 0,
      totalScores: 0
    };
  }
  
  const player = playersMap.get(playerId);
  
  if (player) {
    return player;
  }
  
  // Fallback: player ID not found in map - use placeholder
  console.warn(`⚠️ [PLAYER MAP] Player ID ${playerId} not found, using placeholder "Player ${index}"`);
  return {
    id: playerId,
    name: `Player ${index}`,
    points: 0,
    totalScores: 0
  };
};

/**
 * Convert matches with player IDs to matches with full player data
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
  
  const resolvedMatches = matches.map((match, matchIndex) => {
    // Extract player IDs
    const player1_id = match.player1_id;
    const player2_id = match.player2_id;
    const player3_id = match.player3_id;
    const player4_id = match.player4_id;
    
    // Calculate expected player indices based on match structure
    // For fallback naming: Match 1 uses Player 1-8, Match 2 uses Player 9-16, etc.
    const baseIndex = (matchIndex % 14) * 4; // 4 players per match
    
    // Resolve each player ID to player data
    const player1 = resolvePlayer(player1_id, playersMap, baseIndex + 1);
    const player2 = resolvePlayer(player2_id, playersMap, baseIndex + 2);
    const player3 = resolvePlayer(player3_id, playersMap, baseIndex + 3);
    const player4 = resolvePlayer(player4_id, playersMap, baseIndex + 4);
    
    console.log(`📄 [MATCH RESOLVE] Match #${match.match_number || (matchIndex + 1)}:`, {
      player1: `${player1_id} → ${player1.name}`,
      player2: `${player2_id} → ${player2.name}`,
      player3: `${player3_id} → ${player3.name}`,
      player4: `${player4_id} → ${player4.name}`
    });
    
    return {
      id: match.id,
      match_number: match.match_number || (matchIndex + 1),
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
