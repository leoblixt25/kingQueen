// Whist-8 cyclic tournament schedule — SINGLE SOURCE OF TRUTH
// Produces 14 matches across 7 rounds × 2 courts.
// Guarantees:
//   • Every player partners with each other player exactly 1 time
//   • Every player opposes each other player exactly 2 times
//
// Seeds are 1-indexed in the spec, converted to 0-indexed here.
// The draw shuffles 8 players into seed positions 0..7,
// then maps them deterministically through this matrix.

export const STATIC_MATCHUPS = [
  [0, 1, 3, 7],  // Round 1 Court A: (seed1,seed2) vs (seed4,seed8)
  [2, 5, 4, 6],  // Round 1 Court B: (seed3,seed6) vs (seed5,seed7)
  [1, 2, 4, 7],  // Round 2 Court A: (seed2,seed3) vs (seed5,seed8)
  [3, 6, 5, 0],  // Round 2 Court B: (seed4,seed7) vs (seed6,seed1)
  [2, 3, 5, 7],  // Round 3 Court A: (seed3,seed4) vs (seed6,seed8)
  [4, 0, 6, 1],  // Round 3 Court B: (seed5,seed1) vs (seed7,seed2)
  [3, 4, 6, 7],  // Round 4 Court A: (seed4,seed5) vs (seed7,seed8)
  [5, 1, 0, 2],  // Round 4 Court B: (seed6,seed2) vs (seed1,seed3)
  [4, 5, 0, 7],  // Round 5 Court A: (seed5,seed6) vs (seed1,seed8)
  [6, 2, 1, 3],  // Round 5 Court B: (seed7,seed3) vs (seed2,seed4)
  [5, 6, 1, 7],  // Round 6 Court A: (seed6,seed7) vs (seed2,seed8)
  [0, 3, 2, 4],  // Round 6 Court B: (seed1,seed4) vs (seed3,seed5)
  [6, 0, 2, 7],  // Round 7 Court A: (seed7,seed1) vs (seed3,seed8)
  [1, 4, 3, 5],  // Round 7 Court B: (seed2,seed5) vs (seed4,seed6)
] as const;

export type MatchupIndices = readonly [number, number, number, number];

/**
 * Match with round/court metadata for display purposes.
 * Extends GeneratedMatch — all existing consumers see the base fields.
 */
export interface GeneratedMatch {
  matchNum: number;
  p1: string;
  p2: string;
  p3: string;
  p4: string;
  gender: 'female' | 'male';
  round?: number;
  court?: 'A' | 'B';
}

/**
 * Generate matches from a shuffled player order using the Whist-8 schedule.
 *
 * @param playerOrder - Array of 8 player names (shuffled into seed positions 0..7)
 * @param gender - 'female' or 'male'
 * @returns Array of 14 GeneratedMatch objects
 */
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
      gender,
      round: Math.floor(index / 2) + 1,
      court: index % 2 === 0 ? 'A' : 'B',
    };
  });
}

/**
 * Fisher-Yates (Knuth) shuffle — unbiased, returns a NEW array.
 */
export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Verify the Whist-8 matrix integrity.
 * Returns { ok: true } or { ok: false, errors: string[] }.
 *
 * Checks:
 *   1. Total matches = 14 (7 rounds × 2 courts)
 *   2. Every player plays in exactly 7 matches
 *   3. Every player partners with each other player exactly 1 time
 *   4. Every player opposes each other player exactly 2 times
 */
export function verifyWhist8Integrity(): { ok: true } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const NUM_PLAYERS = 8;
  const NUM_MATCHES = 14;

  if (STATIC_MATCHUPS.length !== NUM_MATCHES) {
    errors.push(`Expected ${NUM_MATCHES} matches, got ${STATIC_MATCHUPS.length}`);
    return { ok: false, errors };
  }

  // Build partner and opponent frequency maps
  const partners: number[][] = Array.from({ length: NUM_PLAYERS }, () => []);
  const opponents: number[][] = Array.from({ length: NUM_PLAYERS }, () => []);

  for (let m = 0; m < STATIC_MATCHUPS.length; m++) {
    const [a, b, c, d] = STATIC_MATCHUPS[m];

    // Validate seed range
    for (const s of [a, b, c, d]) {
      if (s < 0 || s >= NUM_PLAYERS) {
        errors.push(`Match ${m + 1}: seed ${s} out of range [0..${NUM_PLAYERS - 1}]`);
      }
    }

    // Team A: a,b partner; Team B: c,d partner
    partners[a].push(b);
    partners[b].push(a);
    partners[c].push(d);
    partners[d].push(c);

    // Cross-team opposition
    for (const x of [a, b]) {
      for (const y of [c, d]) {
        opponents[x].push(y);
        opponents[y].push(x);
      }
    }
  }

  for (let p = 0; p < NUM_PLAYERS; p++) {
    // Each player plays in exactly 7 matches (2 partners + 4 opponents per match × 7... no)
    // Each match a player appears in: 1 partner + 2 opponents. 7 matches = 7 partners + 14 opponents.
    const totalAppearances = partners[p].length;
    if (totalAppearances !== 7) {
      errors.push(`Player ${p}: plays in ${totalAppearances} matches, expected 7`);
    }

    // Each of the 7 other players should be a partner exactly 1 time
    for (let other = 0; other < NUM_PLAYERS; other++) {
      if (other === p) continue;
      const partnerCount = partners[p].filter(x => x === other).length;
      if (partnerCount !== 1) {
        errors.push(`Player ${p} partners with player ${other}: ${partnerCount} times, expected 1`);
      }

      const opponentCount = opponents[p].filter(x => x === other).length;
      if (opponentCount !== 2) {
        errors.push(`Player ${p} opposes player ${other}: ${opponentCount} times, expected 2`);
      }
    }
  }

  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}

// Female player names — placeholders replaced when players register
export const FEMALE_PLAYERS = [
  "Female Player 1",  // 0 - Seed position 1
  "Female Player 2",  // 1 - Seed position 2
  "Female Player 3",  // 2 - Seed position 3
  "Female Player 4",  // 3 - Seed position 4
  "Female Player 5",  // 4 - Seed position 5
  "Female Player 6",  // 5 - Seed position 6
  "Female Player 7",  // 6 - Seed position 7
  "Female Player 8"   // 7 - Seed position 8
];

// Male player names — placeholders replaced when players register
export const MALE_PLAYERS = [
  "Male Player 1",    // 0 - Seed position 1
  "Male Player 2",    // 1 - Seed position 2
  "Male Player 3",    // 2 - Seed position 3
  "Male Player 4",    // 3 - Seed position 4
  "Male Player 5",    // 4 - Seed position 5
  "Male Player 6",    // 5 - Seed position 6
  "Male Player 7",    // 6 - Seed position 7
  "Male Player 8"     // 7 - Seed position 8
];
