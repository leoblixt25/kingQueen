import { Player, Match, ResolvedMatch } from '@/types';
import { validateMatches, buildValidationMap } from './matchValidation';

/**
 * Build a players map for quick lookup by ID
 * CRITICAL: This is the SINGLE SOURCE OF TRUTH for player lookups
 */
export const buildPlayersMap = (femalePlayers: Player[], malePlayers: Player[]): Map<string, Player> => {
  console.log('🗺️ [PLAYER MAP] Building players map...');

  const playersMap = new Map<string, Player>();

  const allPlayers = [...(femalePlayers || []), ...(malePlayers || [])];
  allPlayers.forEach(player => {
    if (player.id) {
      playersMap.set(player.id, player);
    } else {
      console.warn('⚠️ [PLAYER MAP] Player missing ID:', player);
    }
  });

  console.log('✅ [PLAYER MAP] Total players in map:', playersMap.size);
  return playersMap;
};

/**
 * STRICT: Resolve a player ID to player data
 * FAIL-FAST: Throws if player not found - NEVER returns null
 */
export const resolvePlayerStrict = (
  playerId: string,
  playersMap: Map<string, Player>,
  context: string
): Player => {
  if (!playerId || typeof playerId !== 'string' || playerId.trim() === '') {
    throw new Error(`[PLAYER RESOLVE] Invalid player ID in ${context}: "${playerId}"`);
  }

  const player = playersMap.get(playerId);
  if (!player) {
    const availableIds = Array.from(playersMap.keys()).slice(0, 5).join(', ') + '...';
    throw new Error(
      `[PLAYER RESOLVE] Player ID "${playerId}" NOT FOUND in ${context}. ` +
      `Map has ${playersMap.size} players. Sample IDs: ${availableIds}`
    );
  }

  return player;
};

/**
 * STRICT: Convert matches with player ID arrays to matches with full player data
 * FAIL-FAST: Validates ALL matches first, throws if any invalid
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

  // STEP 1: STRICT VALIDATION - validate ALL matches before processing
  // This ensures we NEVER process invalid data
  const allPlayers = Array.from(playersMap.values());
  try {
    validateMatches(matches, buildValidationMap(allPlayers));
  } catch (validationError) {
    console.error('❌ [MATCH RESOLVE] Validation failed - aborting resolution');
    throw validationError;
  }

  // STEP 2: Resolve player IDs to full player objects
  // At this point we KNOW all IDs are valid, so resolvePlayerStrict will never throw
  const resolvedMatches = matches.map((match, matchIndex) => {
    const matchNum = match.match_number || (matchIndex + 1);
    const context = `match #${matchNum}`;

    const [teamA1_id, teamA2_id] = match.teamA;
    const [teamB1_id, teamB2_id] = match.teamB;

    const teamA1 = resolvePlayerStrict(teamA1_id, playersMap, context);
    const teamA2 = resolvePlayerStrict(teamA2_id, playersMap, context);
    const teamB1 = resolvePlayerStrict(teamB1_id, playersMap, context);
    const teamB2 = resolvePlayerStrict(teamB2_id, playersMap, context);

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

  console.log('✅ [MATCH RESOLVE] Successfully resolved', resolvedMatches.length, 'matches');
  return resolvedMatches;
};
