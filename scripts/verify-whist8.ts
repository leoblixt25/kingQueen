#!/usr/bin/env npx tsx
/**
 * Standalone Whist-8 integrity check.
 * Run: npx tsx scripts/verify-whist8.ts
 *
 * Verifies:
 *   1. Total matches = 14 (7 rounds × 2 courts)
 *   2. Every player plays in exactly 7 matches
 *   3. Every player partners with each other player exactly 1 time
 *   4. Every player opposes each other player exactly 2 times
 */

import { verifyWhist8Integrity, generateMatchesFromOrder, shuffleArray } from '../src/utils/staticMatchups';

const result = verifyWhist8Integrity();

if (!result.ok) {
  console.error('❌ Whist-8 integrity check FAILED:\n');
  for (const err of result.errors) {
    console.error(`  • ${err}`);
  }
  process.exit(1);
}

console.log('✅ Whist-8 integrity check PASSED');
console.log('   • 14 matches (7 rounds × 2 courts)');
console.log('   • 8 players, each plays 7 matches');
console.log('   • Each player partners every other player exactly 1 time');
console.log('   • Each player opposes every other player exactly 2 times');

// Bonus: run a shuffled example to prove the mapping works
const names = ['Alice','Bob','Carol','Dave','Eve','Frank','Grace','Heidi'];
const shuffled = shuffleArray(names);
const matches = generateMatchesFromOrder(shuffled, 'female');
console.log(`\n🎲 Example shuffled order: [${shuffled.join(', ')}]`);
console.log(`   Generated ${matches.length} matches:`);
for (const m of matches) {
  console.log(`   Match ${m.matchNum} (R${m.round} Court ${m.court}): ${m.p1} & ${m.p2} vs ${m.p3} & ${m.p4}`);
}
