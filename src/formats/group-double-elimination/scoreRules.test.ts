import { describe, expect, it } from "vitest";
import {
  DEFAULT_SCORE_RULE,
  normalizeScoreRuleConfig,
  suspiciousScoreWarning,
  validateScore,
} from "./scoreRules";
import type { Team } from "./types";

const LEGACY_RULE = { rule: "first-to-21-cap" as const, cap: null };
const WIN_BY_TWO = { rule: "win-by-2" as const, cap: null };
const LEGACY_CAPPED = { rule: "win-by-2" as const, cap: 25 };

const team = (id: string, seed: number): Team => ({
  id,
  name: `Team ${id}`,
  playerIds: [],
  seed,
  groupId: null,
  status: "approved",
});

describe("score rules", () => {
  it("applies the same beach-volleyball rule to every stored config", () => {
    for (const config of [LEGACY_RULE, WIN_BY_TWO, LEGACY_CAPPED, DEFAULT_SCORE_RULE]) {
      expect(validateScore(21, 19, config).valid).toBe(true);
      expect(validateScore(22, 20, config).valid).toBe(true);
      expect(validateScore(23, 21, config).valid).toBe(true);
      expect(validateScore(24, 22, config).valid).toBe(true);
      expect(validateScore(25, 23, config).valid).toBe(true);
      // No upper cap, including for documents that still store one.
      expect(validateScore(30, 28, config).valid).toBe(true);
    }
  });

  it("requires at least 21 points and a two-point margin", () => {
    expect(validateScore(20, 18).valid).toBe(false);
    expect(validateScore(21, 20).valid).toBe(false);
    expect(validateScore(20, 20).valid).toBe(false);
    expect(validateScore(21, 21).valid).toBe(false);
    expect(validateScore(22, 21).valid).toBe(false);
    expect(validateScore(21, 19).valid).toBe(true);

    expect(validateScore(20, 18).message).toContain("at least 21");
    expect(validateScore(21, 20).message).toContain("lead by at least 2");
  });

  it("rejects negative, fractional and tied scores", () => {
    expect(validateScore(-1, 21).valid).toBe(false);
    expect(validateScore(21.5, 19).valid).toBe(false);
    expect(validateScore(15, 15).valid).toBe(false);
  });

  it("normalises unknown or legacy settings to the shared rule", () => {
    expect(normalizeScoreRuleConfig(undefined, undefined)).toEqual(DEFAULT_SCORE_RULE);
    expect(normalizeScoreRuleConfig("win-by-2", 30)).toEqual(DEFAULT_SCORE_RULE);
    expect(normalizeScoreRuleConfig("first-to-21-cap", 21)).toEqual(DEFAULT_SCORE_RULE);
    expect(normalizeScoreRuleConfig("bogus", 1)).toEqual(DEFAULT_SCORE_RULE);
  });

  it("warns when a top seed is routed heavily by an underdog", () => {
    const teams = [team("t1", 1), team("t16", 16)];
    expect(suspiciousScoreWarning(teams, "t1", "t16", 4, 21)).toContain("Unusual result");
    expect(suspiciousScoreWarning(teams, "t1", "t16", 21, 15)).toBeNull();
    expect(suspiciousScoreWarning([team("t1", 1)], "t1", "t16", 4, 21)).toBeNull();
  });
});
