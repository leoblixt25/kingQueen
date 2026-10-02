import { describe, it, expect } from 'vitest';
import {
  areRankingsVisible,
  countFinishedMatches,
  isMatchFinished,
  RANKINGS_REVEAL_MATCHES,
} from './rankingVisibility';

const match = (over: Partial<{ gender: string; isSubmitted: boolean; score1: number; score2: number }> = {}) => ({
  gender: 'male',
  isSubmitted: false,
  score1: 0,
  score2: 0,
  ...over,
});

describe('isMatchFinished', () => {
  it('treats a submitted match as finished', () => {
    expect(isMatchFinished(match({ isSubmitted: true }))).toBe(true);
  });

  it('treats a fully scored match as finished even if not flagged', () => {
    expect(isMatchFinished(match({ score1: 2, score2: 1 }))).toBe(true);
  });

  it('does not treat a 0-0 scoreline as played', () => {
    expect(isMatchFinished(match({ score1: 0, score2: 0 }))).toBe(false);
  });

  it('requires both scores to be non-zero', () => {
    expect(isMatchFinished(match({ score1: 3, score2: 0 }))).toBe(false);
  });

  it('ignores undefined scores', () => {
    expect(isMatchFinished({ gender: 'male', isSubmitted: false })).toBe(false);
  });
});

describe('countFinishedMatches', () => {
  it('counts only the requested gender', () => {
    const matches = [
      match({ isSubmitted: true }),
      match({ isSubmitted: true }),
      match({ gender: 'female', isSubmitted: true }),
    ];
    expect(countFinishedMatches(matches, 'male')).toBe(2);
    expect(countFinishedMatches(matches, 'female')).toBe(1);
  });

  it('counts both divisions when no gender is given', () => {
    const matches = [
      match({ isSubmitted: true }),
      match({ gender: 'female', isSubmitted: true }),
    ];
    expect(countFinishedMatches(matches)).toBe(2);
  });
});

describe('areRankingsVisible', () => {
  it('stays hidden with no finished matches', () => {
    expect(areRankingsVisible([match(), match(), match()], 'male')).toBe(false);
  });

  it('reveals as soon as one match is finished', () => {
    expect(areRankingsVisible([match({ isSubmitted: true }), match()], 'male')).toBe(true);
  });

  it('does not let another division unlock this one', () => {
    const matches = [
      match({ gender: 'female', isSubmitted: true }),
      match({ gender: 'female', isSubmitted: true }),
      match(),
      match(),
    ];
    expect(areRankingsVisible(matches, 'male')).toBe(false);
    expect(areRankingsVisible(matches, 'female')).toBe(true);
  });

  it('handles an empty match list without revealing', () => {
    expect(areRankingsVisible([], 'male')).toBe(false);
  });

  it('uses a threshold of 1 match', () => {
    expect(RANKINGS_REVEAL_MATCHES).toBe(1);
  });
});