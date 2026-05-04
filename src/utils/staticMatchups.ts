// Static matchup template for both male and female divisions
// This ensures consistent match structure without regeneration
// SINGLE SOURCE OF TRUTH for all 14 match combinations

export const STATIC_MATCHUPS = [
  [0, 1, 2, 3], // Match 1: Team A (0,1) vs Team B (2,3)
  [4, 5, 6, 7], // Match 2: Team A (4,5) vs Team B (6,7)
  [5, 6, 7, 0], // Match 3: Team A (5,6) vs Team B (7,0)
  [3, 4, 1, 2], // Match 4: Team A (3,4) vs Team B (1,2)
  [6, 3, 4, 1], // Match 5: Team A (6,3) vs Team B (4,1)
  [0, 2, 7, 5], // Match 6: Team A (0,2) vs Team B (7,5)
  [2, 4, 3, 7], // Match 7: Team A (2,4) vs Team B (3,7)
  [1, 6, 5, 0], // Match 8: Team A (1,6) vs Team B (5,0)
  [5, 3, 6, 2], // Match 9: Team A (5,3) vs Team B (6,2)
  [7, 1, 0, 4], // Match 10: Team A (7,1) vs Team B (0,4)
  [2, 7, 1, 5], // Match 11: Team A (2,7) vs Team B (1,5)
  [3, 0, 6, 4], // Match 12: Team A (3,0) vs Team B (6,4)
  [7, 4, 0, 6], // Match 13: Team A (7,4) vs Team B (0,6)
  [5, 2, 3, 1]  // Match 14: Team A (5,2) vs Team B (3,1)
] as const;

// Export type for the matchup indices
export type MatchupIndices = readonly [number, number, number, number];

/**
 * Generate matches from a shuffled player order
 * This is the SINGLE source of truth for match generation used by:
 * - Draw wheel (with shuffled player order)
 * - Reset function (with default player order 0-7)
 * 
 * @param playerOrder - Array of player names in the order they should be matched
 * @param gender - 'female' or 'male' for the match gender field
 * @returns Array of match objects with player names and match numbers
 */
export interface GeneratedMatch {
  matchNum: number;
  p1: string;
  p2: string;
  p3: string;
  p4: string;
  gender: 'female' | 'male';
}

export function generateMatchesFromOrder(
  playerOrder: string[],
  gender: 'female' | 'male'
): GeneratedMatch[] {
  if (playerOrder.length !== 8) {
    throw new Error(`Expected exactly 8 players, got ${playerOrder.length}`);
  }

  return STATIC_MATCHUPS.map((indices, index) => {
    const [i1, i2, i3, i4] = indices;
    return {
      matchNum: index + 1,
      p1: playerOrder[i1],
      p2: playerOrder[i2],
      p3: playerOrder[i3],
      p4: playerOrder[i4],
      gender
    };
  });
}

/**
 * Shuffle array using Fisher-Yates algorithm
 * Returns a NEW array, does not mutate input
 */
export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Female player names in order - placeholders that will be replaced when players register
export const FEMALE_PLAYERS = [
  "Female Player 1",  // 0 - Position 1
  "Female Player 2",  // 1 - Position 2
  "Female Player 3",  // 2 - Position 3
  "Female Player 4",  // 3 - Position 4
  "Female Player 5",  // 4 - Position 5
  "Female Player 6",  // 5 - Position 6
  "Female Player 7",  // 6 - Position 7
  "Female Player 8"   // 7 - Position 8
];

// Male player names in order - placeholders that will be replaced when players register
export const MALE_PLAYERS = [
  "Male Player 1",    // 0 - Position 1
  "Male Player 2",    // 1 - Position 2
  "Male Player 3",    // 2 - Position 3
  "Male Player 4",    // 3 - Position 4
  "Male Player 5",    // 4 - Position 5
  "Male Player 6",    // 5 - Position 6
  "Male Player 7",    // 6 - Position 7
  "Male Player 8"     // 7 - Position 8
];