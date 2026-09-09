import { describe, it, expect } from 'vitest';
import { sortPlayersWithTiebreakers } from './rankingTiebreaker';

// Replicates LiveRanking.tsx mapping: players built from Firestore docs,
// matches mapped to { teamA: [id, id], teamB: [id, id], score1, score2 }
function buildLiveData() {
  const players = [
    { id: 'm1', name: 'Liam', points: 2, totalScores: 21, gender: 'male' },
    { id: 'm2', name: 'Noah', points: 2, totalScores: 18, gender: 'male' },
    { id: 'm3', name: 'Mateo', points: 1, totalScores: 15, gender: 'male' },
    { id: 'm4', name: 'Lucas', points: 0, totalScores: 0, gender: 'male' },
  ];
  const matches = [
    {
      id: 'match1',
      match_number: 1,
      gender: 'male',
      teamA: ['m1', 'm2'],
      teamB: ['m3', 'm4'],
      score1: 21,
      score2: 15,
      isSubmitted: true,
    },
    {
      id: 'match2',
      match_number: 2,
      gender: 'male',
      teamA: ['m1', 'm3'],
      teamB: ['m2', 'm4'],
      score1: 0,
      score2: 0,
      isSubmitted: false,
    },
  ];
  return { players, matches };
}

describe('LiveRanking sort repro', () => {
  it('sorts without throwing', () => {
    const { players, matches } = buildLiveData();
    expect(() => sortPlayersWithTiebreakers(players, matches)).not.toThrow();
    const sorted = sortPlayersWithTiebreakers(players, matches);
    expect(sorted.map(p => p.id)[0]).toBe('m1');
  });

  it('handles the initial empty/loading state', () => {
    expect(() => sortPlayersWithTiebreakers([], [])).not.toThrow();
  });
});