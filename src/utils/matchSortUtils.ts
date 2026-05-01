// Match interface with match_number (extends the base Match type)
interface MatchWithNumber {
  id?: string;
  gender?: 'male' | 'female';
  match_number?: number;
  player1?: { name?: string };
  player2?: { name?: string };
  player3?: { name?: string };
  player4?: { name?: string };
  player1_id?: string;
  player2_id?: string;
  player3_id?: string;
  player4_id?: string;
  score1: number;
  score2: number;
  is_completed?: boolean;
  isSubmitted?: boolean;
}

/**
 * Shared utility to sort matches by match_number for consistent ordering
 * between UI and PDF export.
 * 
 * Uses numeric sorting to prevent string-based ordering issues like:
 * Match 1, Match 10, Match 11, Match 2, etc.
 */
export function sortMatchesByNumber<T extends { match_number?: number }>(matches: T[]): T[] {
  return [...matches].sort((a, b) => {
    const numA = Number(a.match_number ?? 9999);
    const numB = Number(b.match_number ?? 9999);
    return numA - numB;
  });
}

/**
 * Filter matches by gender and sort by match_number.
 * Use this in UI components to ensure consistent ordering.
 */
export function getSortedMatchesByGender<T extends { gender?: 'male' | 'female'; match_number?: number }>(
  matches: T[], 
  gender: 'male' | 'female'
): T[] {
  return sortMatchesByGender(matches, gender);
}

/**
 * Sort and filter matches by gender.
 */
export function sortMatchesByGender<T extends { gender?: 'male' | 'female'; match_number?: number }>(
  matches: T[], 
  gender: 'male' | 'female'
): T[] {
  const filtered = matches.filter(m => m.gender === gender);
  return sortMatchesByNumber(filtered);
}

/**
 * Get display matches for UI - ensures consistent sorting.
 * Use this function in UI components when rendering matches.
 */
export function getDisplayMatches<T extends { match_number?: number }>(matches: T[]): T[] {
  return sortMatchesByNumber(matches);
}

/**
 * Sort matches for PDF export - same logic as UI.
 * This ensures PDF and UI have identical match ordering.
 */
export function getPDFSortedMatches<T extends { gender?: 'male' | 'female'; match_number?: number }>(
  femaleMatches: T[], 
  maleMatches: T[]
) {
  return {
    sortedFemale: sortMatchesByNumber(femaleMatches),
    sortedMale: sortMatchesByNumber(maleMatches)
  };
}

/**
 * Validates that all matches have valid match_numbers.
 * Logs warnings for debugging ordering issues.
 */
export function validateMatchNumbers<T extends { match_number?: number }>(matches: T[], context: string): boolean {
  const invalid = matches.filter(m => m.match_number === undefined || m.match_number === null);
  if (invalid.length > 0) {
    console.warn(`[${context}] Found ${invalid.length} matches without match_number:`, invalid);
    return false;
  }
  return true;
}

/**
 * Debug helper to log match order.
 */
export function logMatchOrder<T extends { match_number?: number }>(matches: T[], label: string): void {
  console.log(`[${label}] Match order:`, matches.map(m => m.match_number));
}

export type { MatchWithNumber };

// Default export for convenience
export default sortMatchesByNumber;
