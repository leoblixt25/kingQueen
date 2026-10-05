/**
 * Submitted match scores for the public draw page.
 *
 * The draw page knows the teams for each card from the saved draw, and only
 * needs to know whether a result has been entered. Match documents are keyed by
 * gender and match number, which is exactly how the draw cards are numbered, so
 * a result can be attached to its card without matching any player names.
 *
 * This module is deliberately read-only: it never mutates matches and never
 * submits a score, it only reports which cards already have a result to show.
 */

export type MatchScore = { s1: number; s2: number };

/** Which side won a submitted result: 1 = team A, 2 = team B, 0 = tie. */
export type ScoreSide = 0 | 1 | 2;

/**
 * Which team won, so the draw page can emphasise the winning score.
 * Ties return 0 and leave both scores styled the same.
 */
export const scoreWinner = (s1: number, s2: number): ScoreSide => {
  if (s1 > s2) return 1;
  if (s2 > s1) return 2;
  return 0;
};

export type MatchScoreDoc = {
  gender?: unknown;
  match_number?: unknown;
  is_completed?: unknown;
  score1?: unknown;
  score2?: unknown;
  net?: unknown;
};

/** Lookup key for a draw card: the card's gender plus its match number. */
export const matchScoreKey = (gender: string, matchNumber: number): string =>
  `${gender}_${matchNumber}`;

/**
 * A score is only shown once the match has actually been submitted, so a card
 * never displays a partial or placeholder result.
 */
export const hasSubmittedScore = (m: MatchScoreDoc): boolean =>
  m.is_completed === true &&
  typeof m.score1 === 'number' &&
  Number.isFinite(m.score1) &&
  typeof m.score2 === 'number' &&
  Number.isFinite(m.score2);

/**
 * Build the `${gender}_${match_number}` lookup of submitted results. Unscored
 * matches are simply absent, so their cards fall back to showing teams only.
 */
export const buildMatchScoreMap = (docs: MatchScoreDoc[]): Record<string, MatchScore> => {
  const map: Record<string, MatchScore> = {};
  (docs || []).forEach((m) => {
    if (!m || !hasSubmittedScore(m)) return;
    if (typeof m.gender !== 'string' || typeof m.match_number !== 'number') return;
    map[matchScoreKey(m.gender, m.match_number)] = { s1: m.score1 as number, s2: m.score2 as number };
  });
  return map;
};