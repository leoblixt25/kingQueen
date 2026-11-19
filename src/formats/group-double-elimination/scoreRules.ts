import type { Team, TeamId } from "./types";

/**
 * Score rules shared by group and elimination entry.
 *
 * Both rules only police completed-length games (a winner on 21 or more).
 * Short games (for example a 7-3 warm-up set) remain valid so historical
 * tournaments and imported results are not rejected retroactively.
 */
export type ScoreRule = "first-to-21-cap" | "win-by-2";

export interface ScoreRuleConfig {
  rule: ScoreRule;
  /** Optional hard cap for `win-by-2`, e.g. 30. `null` means no cap. */
  cap: number | null;
}

export interface ScoreValidation {
  valid: boolean;
  message: string | null;
  warning: string | null;
  /** True when the score follows the configured rule exactly. */
  ruleApplied: boolean;
}

export const DEFAULT_SCORE_RULE: ScoreRuleConfig = {
  rule: "first-to-21-cap",
  cap: null,
};

export const normalizeScoreRuleConfig = (
  rule: unknown,
  cap: unknown
): ScoreRuleConfig => ({
  rule: rule === "win-by-2" ? "win-by-2" : "first-to-21-cap",
  cap:
    typeof cap === "number" && Number.isInteger(cap) && cap >= 2
      ? cap
      : null,
});

/**
 * Validate a score pair. Ties and non-integers are always rejected; the
 * configured rule is then applied when the winning score reached 21.
 */
export const validateScore = (
  scoreA: number,
  scoreB: number,
  config: ScoreRuleConfig
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
  let message: string | null = null;
  let ruleApplied = false;

  if (winner >= 21) {
    if (config.rule === "first-to-21-cap") {
      ruleApplied = winner === 21;
      if (winner !== 21) {
        message = `This tournament uses first to 21 with a hard cap: ${winner}-${loser} is not a valid result.`;
      }
    } else {
      ruleApplied = winner - loser >= 2 && (config.cap === null || winner <= config.cap);
      if (winner - loser < 2) {
        message = `This tournament requires a two-point margin (for example 21-${loser >= 19 ? loser - 2 : 19}).`;
      } else if (config.cap !== null && winner > config.cap) {
        message = `The score cap is ${config.cap}; ${winner}-${loser} exceeds it.`;
      }
    }
  }

  return {
    valid: message === null,
    message,
    warning: null,
    ruleApplied,
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
