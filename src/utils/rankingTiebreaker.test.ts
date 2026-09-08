import { describe, it, expect } from 'vitest';
import { comparePlayers, sortPlayersWithTiebreakers } from './rankingTiebreaker';
import type { Player, Match } from '@/types';

const players = (list: Array<[string, number, number]>): Player[] =>
  list.map(([id, points, totalScores]) => ({ id, name: id, points, totalScores }));

describe('comparePlayers tiebreakers', () => {
  it('ranks by points, then total scores, then id when fully tied', () => {
    const a: Player = { id: 'a', name: 'A', points: 2, totalScores: 10 };
    const b: Player = { id: 'b', name: 'B', points: 2, totalScores: 10 };
    const sorted = sortPlayersWithTiebreakers([a, b], []);
    expect(sorted.map(p => p.id)).toEqual(['a', 'b']);
  });

  it('puts higher points first', () => {
    const a: Player = { id: 'a', name: 'A', points: 1, totalScores: 10 };
    const b: Player = { id: 'b', name: 'B', points: 3, totalScores: 5 };
    const sorted = sortPlayersWithTiebreakers([a, b], []);
    expect(sorted.map(p => p.id)).toEqual(['b', 'a']);
  });

  it('uses head-to-head to break ties with correct direction', () => {
    const alice: Player = { id: 'alice', name: 'Alice', points: 2, totalScores: 20 };
    const bob: Player = { id: 'bob', name: 'Bob', points: 2, totalScores: 20 };

    // Alice & Bob played against each other once; Bob's team won 21-18
    const match: Match = {
      id: 'm1',
      match_number: 1,
      teamA: ['alice', 'a2'],
      teamB: ['bob', 'b2'],
      score1: 18,
      score2: 21,
      isSubmitted: true,
    };

    const sorted = sortPlayersWithTiebreakers([alice, bob], [match]);
    // Bob won the head-to-head → Bob should rank above Alice
    expect(sorted.map(p => p.id)).toEqual(['bob', 'alice']);
    expect(comparePlayers(bob, alice, [match], new Map())).toBeLessThan(0);
  });

  it('is deterministic across repeated sorts', () => {
    const list = players([
      ['d', 2, 15],
      ['a', 3, 10],
      ['c', 2, 15],
      ['b', 1, 20],
    ]);
    const first = sortPlayersWithTiebreakers(list, []).map(p => p.id);
    const second = sortPlayersWithTiebreakers([...list].reverse(), []).map(p => p.id);
    expect(first).toEqual(second);
  });
});