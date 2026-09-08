import { Match } from '@/types';

/**
 * STRICT MATCH VALIDATION
 * =======================
 * Zero tolerance for invalid match data.
 * Every match MUST contain exactly 4 valid player IDs.
 *
 * These validations are FAIL-FAST:
 * - Invalid matches throw errors immediately
 * - No recovery, no fallbacks, no silent failures
 */

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate a single match's structure and player IDs
 * FAIL-FAST: Returns first error found
 */
export function validateMatch(match: Match, index: number, playerMap: Map<string, unknown>): ValidationResult {
  const errors: string[] = [];

  // 1. Validate teamA exists and has exactly 2 elements
  if (!match.teamA || !Array.isArray(match.teamA)) {
    errors.push(`Match ${index}: teamA is missing or not an array`);
    return { valid: false, errors };
  }
  if (match.teamA.length !== 2) {
    errors.push(`Match ${index}: teamA must have exactly 2 players, got ${match.teamA.length}`);
    return { valid: false, errors };
  }

  // 2. Validate teamB exists and has exactly 2 elements
  if (!match.teamB || !Array.isArray(match.teamB)) {
    errors.push(`Match ${index}: teamB is missing or not an array`);
    return { valid: false, errors };
  }
  if (match.teamB.length !== 2) {
    errors.push(`Match ${index}: teamB must have exactly 2 players, got ${match.teamB.length}`);
    return { valid: false, errors };
  }

  // 3. Validate all player IDs are non-null strings
  const allIds = [...match.teamA, ...match.teamB];
  for (let i = 0; i < allIds.length; i++) {
    const id = allIds[i];
    const teamLabel = i < 2 ? `teamA[${i}]` : `teamB[${i - 2}]`;

    if (!id) {
      errors.push(`Match ${index}: ${teamLabel} has null/undefined player ID`);
      return { valid: false, errors };
    }
    if (typeof id !== 'string') {
      errors.push(`Match ${index}: ${teamLabel} player ID is not a string: ${typeof id}`);
      return { valid: false, errors };
    }
    if (id.trim() === '') {
      errors.push(`Match ${index}: ${teamLabel} player ID is empty string`);
      return { valid: false, errors };
    }
  }

  // 4. Validate all player IDs exist in the player map
  for (let i = 0; i < allIds.length; i++) {
    const id = allIds[i];
    if (!playerMap.has(id)) {
      const teamLabel = i < 2 ? `teamA` : `teamB`;
      const pos = i < 2 ? i : i - 2;
      errors.push(`Match ${index}: player ID "${id}" in ${teamLabel}[${pos}] not found in player map`);
      return { valid: false, errors };
    }
  }

  // 5. Validate no duplicate player IDs within a match (a player can't be on both teams)
  const uniqueIds = new Set(allIds);
  if (uniqueIds.size !== 4) {
    errors.push(`Match ${index}: duplicate player IDs detected - same player on both teams`);
    return { valid: false, errors };
  }

  return { valid: true, errors: [] };
}

/**
 * Validate an array of matches
 * FAIL-FAST: Throws on first invalid match
 */
export function validateMatches(matches: Match[], playerMap: Map<string, unknown>): void {
  if (!matches || matches.length === 0) {
    throw new Error('MATCH VALIDATION FAILED: No matches provided');
  }

  for (let i = 0; i < matches.length; i++) {
    const result = validateMatch(matches[i], i, playerMap);
    if (!result.valid) {
      const errorMsg = `MATCH VALIDATION FAILED:\n${result.errors.join('\n')}`;
      console.error('❌ [MATCH VALIDATION]', errorMsg);
      throw new Error(errorMsg);
    }
  }

  console.log(`✅ [MATCH VALIDATION] All ${matches.length} matches validated successfully`);
}

/**
 * Build a validation-safe player map from player arrays
 */
export function buildValidationMap(players: { id?: string }[]): Map<string, unknown> {
  const map = new Map<string, unknown>();
  players.forEach(p => {
    if (p.id) {
      map.set(p.id, true);
    }
  });
  return map;
}

/**
 * Strict wrapper: validates then returns matches, or throws
 */
export function enforceValidMatches(matches: Match[], players: { id?: string }[]): Match[] {
  const playerMap = buildValidationMap(players);
  validateMatches(matches, playerMap);
  return matches;
}

/**
 * SAFE RECOVERY: Regenerate matches from player order using static matchups
 * Only called when loaded/saved match data is corrupt or stale
 */
export function regenerateMatches(
  playerOrder: string[],
  gender: 'female' | 'male',
  generateFn: (order: string[], g: 'female' | 'male') => Match[]
): Match[] {
  console.log(`🔄 [RECOVERY] Regenerating ${gender} matches from player order...`);
  const regenerated = generateFn(playerOrder, gender);
  console.log(`✅ [RECOVERY] Regenerated ${regenerated.length} ${gender} matches`);
  return regenerated;
}

/**
 * VALIDATE OR RECOVER: Try to validate matches, regenerate if invalid
 * SAFE: Never returns invalid data. Either returns valid matches or regenerates.
 */
export function validateOrRegenerate(
  matches: Match[],
  players: { id?: string }[],
  playerOrder: string[],
  gender: 'female' | 'male',
  generateFn: (order: string[], g: 'female' | 'male') => Match[]
): Match[] {
  const playerMap = buildValidationMap(players);

  try {
    validateMatches(matches, playerMap);
    console.log(`✅ [VALIDATE+RECOVER] ${gender} matches are valid`);
    return matches;
  } catch (error) {
    console.error(`❌ [VALIDATE+RECOVER] ${gender} matches invalid:`, error);
    console.warn(`⚠️ [VALIDATE+RECOVER] Regenerating ${gender} matches...`);

    const regenerated = regenerateMatches(playerOrder, gender, generateFn);
    validateMatches(regenerated, playerMap);
    console.warn(`⚠️ [VALIDATE+RECOVER] Matches were regenerated due to invalid data`);

    return regenerated;
  }
}
