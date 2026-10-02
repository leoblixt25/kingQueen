/**
 * Ranking visibility gate.
 *
 * With no matches played the ranking order is purely an artefact of the
 * tiebreaker fallback, so it should not be presented as a result. Names stay
 * blank until the first match of the division has been played and submitted.
 *
 * This module is deliberately read-only: it never mutates players, matches or
 * points, it only decides whether the existing ranking list may be revealed.
 */

export const RANKINGS_REVEAL_MATCHES = 1;

export type MatchCompletionLike = {
  gender?: string;
  isSubmitted?: boolean;
  score1?: number;
  score2?: number;
};

/**
 * A match counts as finished when it has been submitted, or when both set
 * scores are present and non-zero. Mirrors the counter already shown in the
 * Live Ranking tab so the two never disagree.
 */
export const isMatchFinished = (m: MatchCompletionLike): boolean =>
  m.isSubmitted === true ||
  (m.score1 !== undefined && m.score2 !== undefined && m.score1 > 0 && m.score2 > 0);

/** Completed matches in one division, or across all divisions when `gender` is omitted. */
export const countFinishedMatches = (matches: MatchCompletionLike[], gender?: string): number =>
  matches.filter((m) => (!gender || m.gender === gender) && isMatchFinished(m)).length;

/** Rankings (names + positions) may only be shown once the opening matches are done. */
export const areRankingsVisible = (matches: MatchCompletionLike[], gender?: string): boolean =>
  countFinishedMatches(matches, gender) >= RANKINGS_REVEAL_MATCHES;