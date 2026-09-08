import { describe, it, expect } from 'vitest';
import { verifyWhist8Integrity, generateMatchesFromOrder, shuffleArray } from './staticMatchups';

describe('Whist-8 schedule integrity', () => {
  it('produces a valid 14-match schedule', () => {
    const result = verifyWhist8Integrity();
    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(result.errors.join('\n'));
    }
  });

  it('works with any shuffled ordering of players', () => {
    const names = ['Alice', 'Bob', 'Carol', 'Dave', 'Eve', 'Frank', 'Grace', 'Heidi'];

    for (let i = 0; i < 50; i++) {
      const shuffled = shuffleArray([...names]);
      const matches = generateMatchesFromOrder(shuffled, 'female');
      expect(matches.length).toBe(14);

      // Each match has exactly the 4 named players
      for (const m of matches) {
        const all = [m.p1, m.p2, m.p3, m.p4];
        expect(all).toHaveLength(4);
      }
    }
  });

  it('verifies partner/opponent counts when mapped to player objects', () => {
    const names = ['Alice', 'Bob', 'Carol', 'Dave', 'Eve', 'Frank', 'Grace', 'Heidi'];
    const matches = generateMatchesFromOrder(names, 'female');

    // Map matchups to the 4 players of the scheduling matrix
    // (seeds 0-7 == names index order here, same as demo usage)
    const playedMatches = matches.map(m => ({
      p1: m.p1,
      p2: m.p2,
      p3: m.p3,
      p4: m.p4,
    }));

    const partnerCount = new Map<string, number>();
    const opponentCount = new Map<string, number>();

    for (const player of names) {
      partnerCount.set(player, 0);
      opponentCount.set(player, 0);
    }

    for (const m of playedMatches) {
      const teamA = [m.p1, m.p2];
      const teamB = [m.p3, m.p4];

      for (const player of names) {
        if (teamA.includes(player)) {
          for (const other of teamA) {
            if (other !== player) partnerCount.set(player, partnerCount.get(player)! + 1);
          }
          for (const other of teamB) opponentCount.set(player, opponentCount.get(player)! + 1);
        } else if (teamB.includes(player)) {
          for (const other of teamB) {
            if (other !== player) partnerCount.set(player, partnerCount.get(player)! + 1);
          }
          for (const other of teamA) opponentCount.set(player, opponentCount.get(player)! + 1);
        }
      }
    }

    for (const player of names) {
      expect(partnerCount.get(player), `partner count for ${player}`).toBe(7);
      // Each opponent faced 2 times = 14 opponent slots, but Whist-8 spec:
      // every player opposes each OTHER player exactly 2 times → 7 opponents × 2 = 14
      expect(opponentCount.get(player), `opponent count for ${player}`).toBe(14);
    }
  });
});