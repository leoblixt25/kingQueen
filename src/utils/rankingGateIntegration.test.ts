import { describe, it, expect, vi } from 'vitest';
import { resolveMatchPlayers, buildPlayersMap } from './matchPlayerResolver';
import { areRankingsVisible } from './rankingVisibility';
import type { Match, Player } from '@/types';

/**
 * End-to-end guard for the ranking name gate.
 *
 * Runs the REAL pipeline that the app uses:
 *   Firestore doc -> Match (as loadMaps does) -> resolveMatchPlayers -> areRankingsVisible
 * If any link silently drops `gender` or `isSubmitted`, names would never appear.
 */

vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'error').mockImplementation(() => {});

const mkPlayer = (id: string, gender: string, points = 0): Player => ({
  id,
  name: `Player ${id}`,
  points,
  totalScores: 0,
  gender,
} as Player);

const mkDoc = (over: Partial<Match> & { gender: string }) => ({
  id: `${over.gender}_match`,
  match_number: 1,
  score1: 0,
  score2: 0,
  is_completed: false,
  ...over,
});

/** Mirrors loadMatches() in firebaseUtils.ts */
const toMatch = (doc: ReturnType<typeof mkDoc>): Match => ({
  id: doc.id,
  match_number: Number(doc.match_number),
  gender: doc.gender as 'male' | 'female',
  teamA: [doc.teamA?.[0], doc.teamA?.[1]] as [string, string],
  teamB: [doc.teamB?.[0], doc.teamB?.[1]] as [string, string],
  score1: doc.score1 || 0,
  score2: doc.score2 || 0,
  isSubmitted: doc.is_completed || false,
} as Match);

describe('ranking names gate over the real pipeline', () => {
  const players = [
    mkPlayer('male_1', 'male'),
    mkPlayer('male_2', 'male'),
    mkPlayer('male_3', 'male'),
    mkPlayer('male_4', 'male'),
    mkPlayer('female_1', 'female'),
    mkPlayer('female_2', 'female'),
    mkPlayer('female_3', 'female'),
    mkPlayer('female_4', 'female'),
  ];

  const baseMatch = {
    teamA: ['male_1', 'male_2'] as [string, string],
    teamB: ['male_3', 'male_4'] as [string, string],
  };

  const build = (maleCompleted: boolean) => {
    // Realistic fixture: updateMatchScore() always writes score1, score2 and
    // is_completed together, so an unplayed match has 0-0.
    const docs = [
      mkDoc({
        ...baseMatch,
        gender: 'male',
        match_number: 1,
        is_completed: maleCompleted,
        score1: maleCompleted ? 2 : 0,
        score2: maleCompleted ? 1 : 0,
      }),
      mkDoc({ ...baseMatch, gender: 'male', match_number: 2, is_completed: false }),
      mkDoc({
        gender: 'female',
        match_number: 1,
        teamA: ['female_1', 'female_2'],
        teamB: ['female_3', 'female_4'],
      }),
    ];
    const matches = docs.map(toMatch);
    const resolved = resolveMatchPlayers(matches, buildPlayersMap([], players));
    return resolved;
  };

  it('keeps gender through resolution (otherwise the gate could never open)', () => {
    const resolved = build(false);
    expect(resolved[0].gender).toBe('male');
    expect(resolved[2].gender).toBe('female');
  });

  it('keeps isSubmitted through resolution', () => {
    const resolved = build(true);
    expect(resolved[0].isSubmitted).toBe(true);
    expect(resolved[1].isSubmitted).toBe(false);
  });

  it('hides names while no result is submitted', () => {
    expect(areRankingsVisible(build(false), 'male')).toBe(false);
  });

  it('shows names once the first male result is submitted', () => {
    expect(areRankingsVisible(build(true), 'male')).toBe(true);
  });

  it('does not let a male result reveal the female division', () => {
    expect(areRankingsVisible(build(true), 'female')).toBe(false);
  });

  it('still returns a usable ranking list with real names after unlocking', () => {
    const resolved = build(true);
    const names = resolved
      .flatMap((m) => [...m.teamA, ...m.teamB])
      .map((p) => p.name);
    expect(names.length).toBeGreaterThan(0);
    expect(names.every((n) => typeof n === 'string' && n.length > 0)).toBe(true);
  });
});