import { describe, it, expect } from 'vitest';
import {
  buildMatchScoreMap,
  hasSubmittedScore,
  matchScoreKey,
} from './matchScores';

const match = (over: Record<string, unknown> = {}) => ({
  gender: 'female',
  match_number: 1,
  is_completed: true,
  score1: 21,
  score2: 17,
  ...over,
});

describe('matchScoreKey', () => {
  it('joins gender and match number the way draw cards are numbered', () => {
    expect(matchScoreKey('female', 3)).toBe('female_3');
    expect(matchScoreKey('male', 14)).toBe('male_14');
  });

  it('never collides across genders', () => {
    expect(matchScoreKey('female', 1)).not.toBe(matchScoreKey('male', 1));
  });
});

describe('hasSubmittedScore', () => {
  it('accepts a completed match with two real scores', () => {
    expect(hasSubmittedScore(match())).toBe(true);
  });

  it('accepts a legitimate 21-0 set score', () => {
    expect(hasSubmittedScore(match({ score1: 21, score2: 0 }))).toBe(true);
  });

  it('rejects a match that is not completed', () => {
    expect(hasSubmittedScore(match({ is_completed: false }))).toBe(false);
    expect(hasSubmittedScore(match({ is_completed: undefined }))).toBe(false);
  });

  it('rejects missing or non-numeric scores', () => {
    expect(hasSubmittedScore(match({ score1: undefined }))).toBe(false);
    expect(hasSubmittedScore(match({ score2: null }))).toBe(false);
    expect(hasSubmittedScore(match({ score1: '21' }))).toBe(false);
    expect(hasSubmittedScore(match({ score2: NaN }))).toBe(false);
  });
});

describe('buildMatchScoreMap', () => {
  it('maps every completed match by gender and number', () => {
    const map = buildMatchScoreMap([
      match({ gender: 'female', match_number: 1, score1: 7, score2: 21 }),
      match({ gender: 'male', match_number: 1, score1: 21, score2: 17 }),
    ]);
    expect(map['female_1']).toEqual({ s1: 7, s2: 21 });
    expect(map['male_1']).toEqual({ s1: 21, s2: 17 });
  });

  it('omits unscored matches so their cards show teams only', () => {
    const map = buildMatchScoreMap([
      match({ match_number: 1, is_completed: false }),
      match({ match_number: 2, score1: undefined, score2: undefined }),
      match({ match_number: 3, is_completed: false, score1: 21, score2: 17 }),
    ]);
    expect(map).toEqual({});
  });

  it('keeps female and male results separate for the same number', () => {
    const map = buildMatchScoreMap([
      match({ gender: 'female', match_number: 5, score1: 21, score2: 14 }),
      match({ gender: 'male', match_number: 5, score1: 12, score2: 21 }),
    ]);
    expect(map['female_5'].s1).toBe(21);
    expect(map['male_5'].s1).toBe(12);
  });

  it('preserves a real 0 score rather than treating it as missing', () => {
    const map = buildMatchScoreMap([match({ score1: 21, score2: 0 })]);
    expect(map['female_1']).toEqual({ s1: 21, s2: 0 });
  });

  it('handles the real 28 match tournament shape', () => {
    const docs = [
      ...Array.from({ length: 14 }, (_, i) =>
        match({ gender: 'female', match_number: i + 1, score1: 21, score2: 18 - (i % 5) })),
      ...Array.from({ length: 14 }, (_, i) =>
        match({ gender: 'male', match_number: i + 1, score1: 21, score2: 15 + (i % 7) })),
    ];
    const map = buildMatchScoreMap(docs);
    expect(Object.keys(map)).toHaveLength(28);
    for (let n = 1; n <= 14; n++) {
      expect(map[matchScoreKey('female', n)]).toBeDefined();
      expect(map[matchScoreKey('male', n)]).toBeDefined();
    }
  });

  it('ignores malformed docs instead of throwing', () => {
    const map = buildMatchScoreMap([
      null as never,
      undefined as never,
      {},
      match({ gender: undefined }),
      match({ match_number: '3' }),
    ]);
    expect(map).toEqual({});
  });

  it('tolerates an empty or missing collection', () => {
    expect(buildMatchScoreMap([])).toEqual({});
    expect(buildMatchScoreMap(undefined as never)).toEqual({});
  });
});