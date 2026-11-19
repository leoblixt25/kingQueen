import { describe, expect, it } from "vitest";
import {
  normalizeScoreRuleConfig,
  suspiciousScoreWarning,
  validateScore,
} from "./scoreRules";
import type { Team } from "./types";

const CAP = { rule: "first-to-21-cap" as const, cap: null };
const WIN_BY_TWO = { rule: "win-by-2" as const, cap: null };
const WIN_BY_TWO_CAP = { rule: "win-by-2" as const, cap: 25 };

const team = (id: string, seed: number): Team => ({
  id,
  name: `Team ${id}`,
  playerIds: [],
  seed,
  groupId: null,
  status: "approved",
});

describe("score rules", () => {
  it("first to 21 with a hard cap only accepts a winner on exactly 21", () => {
    expect(validateScore(21, 19, CAP).valid).toBe(true);
    expect(validateScore(19, 21, CAP).valid).toBe(true);
    expect(validateScore(22, 20, CAP).valid).toBe(false);
    expect(validateScore(24, 22, CAP).valid).toBe(false);
  });

  it("keeps short historical games valid and always rejects ties", () => {
    expect(validateScore(7, 3, CAP).valid).toBe(true);
    expect(validateScore(7, 3, WIN_BY_TWO).valid).toBe(true);
    expect(validateScore(15, 15, CAP).valid).toBe(false);
    expect(validateScore(21, 21, WIN_BY_TWO).valid).toBe(false);
  });

  it("win by 2 requires a two-point margin and honours an optional cap", () => {
    expect(validateScore(21, 19, WIN_BY_TWO).valid).toBe(true);
    expect(validateScore(22, 20, WIN_BY_TWO).valid).toBe(true);
    expect(validateScore(21, 20, WIN_BY_TWO).valid).toBe(false);
    expect(validateScore(26, 24, WIN_BY_TWO_CAP).valid).toBe(false);
    expect(validateScore(25, 23, WIN_BY_TWO_CAP).valid).toBe(true);
  });

  it("normalises unknown or legacy settings to a safe default", () => {
    expect(normalizeScoreRuleConfig(undefined, undefined)).toEqual(CAP);
    expect(normalizeScoreRuleConfig("win-by-2", 30)).toEqual({
      rule: "win-by-2",
      cap: 30,
    });
    expect(normalizeScoreRuleConfig("bogus", 1)).toEqual(CAP);
  });

  it("warns when a top seed is routed heavily by an underdog", () => {
    const teams = [team("t1", 1), team("t16", 16)];
    expect(suspiciousScoreWarning(teams, "t1", "t16", 4, 21)).toContain("Unusual result");
    expect(suspiciousScoreWarning(teams, "t1", "t16", 21, 15)).toBeNull();
    expect(suspiciousScoreWarning([team("t1", 1)], "t1", "t16", 4, 21)).toBeNull();
  });
});
