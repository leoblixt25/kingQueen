import type { Team, TeamId } from "./types";

/**
 * Beach-volleyball set scoring shared by group and elimination entry.
 *
 * A completed set is won by the first team to reach at least 21 points with a
 * lead of at least 2. There is no upper cap: from 20-20 play continues until
 * one team leads by 2 (22-20, 23-21, 25-23, ...). The identical rule applies to
 * group-stage and elimination matches.
 *
 * `ScoreRule`/`ScoreRuleConfig` are retained for persisted-document
 * compatibility. Every stored variant normalises to this one rule, so legacy
 * tournaments configured with "first to 21" also accept extended scores.
 */
export type ScoreRule = "first-to-21-cap" | "win-by-2";

export interface ScoreRuleConfig {
  /** Kept for legacy documents; no longer affects validation. */
  rule: ScoreRule;
  /** @deprecated Extended sets have no cap. Kept for legacy documents. */
  cap: number | null;
}

export interface ScoreValidation {
  valid: boolean;
  message: string | null;
  warning: string | null;
  /** True when the score follows the configured rule exactly. */
  ruleApplied: boolean;
}

export const BEACH_WINNING_POINTS = 21;
export const BEACH_WINNING_MARGIN = 2;

export const DEFAULT_SCORE_RULE: ScoreRuleConfig = {
  rule: "win-by-2",
  cap: null,
};

export const normalizeScoreRuleConfig = (
  _rule: unknown,
  _cap: unknown
): ScoreRuleConfig => DEFAULT_SCORE_RULE;

/**
 * Validate any score pair with the same beach-volleyball rule. Ties,
 * non-integers and a winner below 21 are rejected; from 21 onward the winner
 * must lead by at least 2 with no upper limit.
 */
export const validateScore = (
  scoreA: number,
  scoreB: number,
  _config: ScoreRuleConfig = DEFAULT_SCORE_RULE
): ScoreValidation => {
  if (
    !Number.isInteger(scoreA) ||
    !Number.isInteger(scoreB) ||
    scoreA < 0 ||
    scoreB < 0
  ) {
    return {
      valid: false,
      message: "Scores must be non-negative whole numbers.",
      warning: null,
      ruleApplied: false,
    };
  }
  if (scoreA === scoreB) {
    return {
      valid: false,
      message: "A set cannot end in a tie.",
      warning: null,
      ruleApplied: false,
    };
  }

  const winner = Math.max(scoreA, scoreB);
  const loser = Math.min(scoreA, scoreB);
  if (winner < BEACH_WINNING_POINTS) {
    return {
      valid: false,
      message: `The winning team must score at least ${BEACH_WINNING_POINTS} points.`,
      warning: null,
      ruleApplied: false,
    };
  }
  if (winner - loser < BEACH_WINNING_MARGIN) {
    return {
      valid: false,
      message: `The winner must lead by at least ${BEACH_WINNING_MARGIN} points (for example 21-19, 22-20 or 25-23).`,
      warning: null,
      ruleApplied: false,
    };
  }

  return {
    valid: true,
    message: null,
    warning: null,
    ruleApplied: true,
  };
};

/**
 * Flag a result that looks wrong even though it satisfies the score rule,
 * e.g. the top seed losing 1-21. This is advisory only: the result is kept and
 * the note is written to the audit trail and shown to the admin.
 */
export const suspiciousScoreWarning = (
  teams: readonly Team[],
  teamAId: TeamId,
  teamBId: TeamId,
  scoreA: number,
  scoreB: number
): string | null => {
  const a = teams.find((team) => team.id === teamAId);
  const b = teams.find((team) => team.id === teamBId);
  if (!a || !b || a.seed === null || b.seed === null) return null;

  const favourite = a.seed < b.seed ? a : b;
  const underdog = a.seed < b.seed ? b : a;
  const favouriteScore = a.seed < b.seed ? scoreA : scoreB;
  const underdogScore = a.seed < b.seed ? scoreB : scoreA;
  const margin = underdogScore - favouriteScore;

  if (margin >= 12 && favouriteScore <= 8) {
    return `Unusual result: ${favourite.name} (seed ${favourite.seed}) lost ${favouriteScore}-${underdogScore} to ${underdog.name} (seed ${underdog.seed}). Please double-check.`;
  }
  return null;
};

/** Assert a valid score, throwing a plain error the caller wraps in ScoringError. */
export const assertScoreRule = (
  scoreA: number,
  scoreB: number,
  config: ScoreRuleConfig
): ScoreValidation => {
  const result = validateScore(scoreA, scoreB, config);
  if (!result.valid) throw new Error(result.message ?? "Invalid score.");
  return result;
};
