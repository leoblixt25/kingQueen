import { describe, expect, it } from "vitest";
import {
  KING_QUEEN_FORMAT,
  TOURNAMENT_FORMAT_DEFINITIONS,
  getTournamentFormatDefinition,
} from "@/formats/registry";
import {
  FEMALE_PLAYERS,
  MALE_PLAYERS,
  STATIC_MATCHUPS,
  generateMatchesFromOrder,
  shuffleArray,
  verifyWhist8Integrity,
} from "./staticMatchups";
import {
  comparePlayers,
  getTiebreakerLevel,
  sortPlayersWithTiebreakers,
} from "./rankingTiebreaker";
import {
  RANKINGS_REVEAL_MATCHES,
  areRankingsVisible,
} from "./rankingVisibility";
import type { Match, Player } from "@/types";

/**
 * Phase 11 regression matrix — EXISTING King & Queen format.
 *
 * The new group-stage format must never change K&Q behaviour. These tests pin
 * the observable behaviour of the pure K&Q modules (format registry, Whist-8
 * draw, ranking tiebreakers and the ranking reveal gate) to exact, known-good
 * values. Any accidental edit to K&Q logic or data will fail here.
 *
 * Only pure modules are imported — no React, no Firebase, and no K&Q source
 * file is modified by this suite.
 */

const player = (id: string, points: number, totalScores: number): Player => ({
  id,
  name: id,
  points,
  totalScores,
});

const match = (
  match_number: number,
  teamA: [string, string],
  teamB: [string, string],
  score1: number,
  score2: number
): Match => ({
  id: `m${match_number}`,
  match_number,
  teamA,
  teamB,
  score1,
  score2,
  isSubmitted: true,
});

describe("Phase 11 regression matrix — existing King & Queen unchanged", () => {
  // ---- "Open existing K&Q works exactly as before" ----
  describe("format registry keeps the original K&Q entry point", () => {
    it("keeps the live K&Q definition byte-for-byte on its core fields", () => {
      expect(KING_QUEEN_FORMAT.id).toBe("king-queen");
      expect(KING_QUEEN_FORMAT.name).toBe("King & Queen of the Beach");
      expect(KING_QUEEN_FORMAT.shortName).toBe("King & Queen");
      expect(KING_QUEEN_FORMAT.route).toBe("/king-queen");
      expect(KING_QUEEN_FORMAT.status).toBe("live");
      expect(KING_QUEEN_FORMAT.selectable).toBe(true);
    });

    it("keeps K&Q first and distinct from the new format's namespace", () => {
      expect(TOURNAMENT_FORMAT_DEFINITIONS.map((format) => format.id)).toEqual([
        "king-queen",
        "group-double-elimination",
      ]);
      expect(KING_QUEEN_FORMAT.route.startsWith("/formats/")).toBe(false);
      expect(
        getTournamentFormatDefinition("king-queen").route
      ).toBe("/king-queen");
    });
  });

  // ---- "Existing K&Q draw unchanged" ----
  describe("Whist-8 draw matrix is unchanged", () => {
    const EXPECTED_MATCHUPS = [
      [0, 1, 3, 7],
      [2, 5, 4, 6],
      [1, 2, 4, 7],
      [3, 6, 5, 0],
      [2, 3, 5, 7],
      [4, 0, 6, 1],
      [3, 4, 6, 7],
      [5, 1, 0, 2],
      [4, 5, 0, 7],
      [6, 2, 1, 3],
      [5, 6, 1, 7],
      [0, 3, 2, 4],
      [6, 0, 2, 7],
      [1, 4, 3, 5],
    ];

    it("still contains the exact 14×4 seed matrix", () => {
      expect(STATIC_MATCHUPS.map((row) => [...row])).toEqual(EXPECTED_MATCHUPS);
      expect(STATIC_MATCHUPS).toHaveLength(14);
    });

    it("still generates 14 matches over 7 rounds × 2 courts with a fixed order", () => {
      const order = Array.from({ length: 8 }, (_, index) => `p${index + 1}`);
      const generated = generateMatchesFromOrder(order, "female");

      expect(generated).toHaveLength(14);
      expect(generated.map((item) => item.matchNum)).toEqual(
        Array.from({ length: 14 }, (_, index) => index + 1)
      );
      expect(generated.every((item) => item.gender === "female")).toBe(true);

      // Round = floor(index / 2) + 1, court alternates A/B.
      expect(generated.map((item) => item.round)).toEqual([
        1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7,
      ]);
      expect(generated.map((item) => item.court)).toEqual([
        "A", "B", "A", "B", "A", "B", "A", "B", "A", "B", "A", "B", "A", "B",
      ]);

      // The first match maps seed indices [0,1,3,7] into p1..p4.
      expect(generated[0]).toMatchObject({
        p1: "p1",
        p2: "p2",
        p3: "p4",
        p4: "p8",
        round: 1,
        court: "A",
      });

      // A fixed order always reproduces the exact same schedule.
      expect(generateMatchesFromOrder(order, "male")).toEqual(
        generateMatchesFromOrder(order, "male")
      );
    });

    it("still guarantees partner ×1 / opponent ×2 for every player", () => {
      expect(verifyWhist8Integrity()).toEqual({ ok: true });
    });

    it("still rejects a wrong player count and never mutates its input", () => {
      expect(() => generateMatchesFromOrder(["p1", "p2"], "female")).toThrow(
        /Expected exactly 8 players/
      );
      const source = Array.from({ length: 8 }, (_, index) => `p${index}`);
      const copy = [...source];
      shuffleArray(source);
      expect(source).toEqual(copy);
    });

    it("still ships the 8 female and 8 male placeholder names", () => {
      expect(FEMALE_PLAYERS).toHaveLength(8);
      expect(MALE_PLAYERS).toHaveLength(8);
      expect(FEMALE_PLAYERS[0]).toBe("Female Player 1");
      expect(MALE_PLAYERS[7]).toBe("Male Player 8");
    });
  });

  // ---- "Existing K&Q ranking unchanged" ----
  describe("ranking tiebreaker chain is unchanged", () => {
    it("breaks ties in the documented order: points → score → difference → head-to-head → opponents → id", () => {
      // Points first (regardless of stored score).
      expect(
        sortPlayersWithTiebreakers(
          [player("a", 1, 100), player("b", 3, 5)],
          []
        ).map((item) => item.id)
      ).toEqual(["b", "a"]);

      // Equal points → totalScores.
      const byScore = [player("a", 2, 10), player("b", 2, 20)];
      expect(sortPlayersWithTiebreakers(byScore, []).map((item) => item.id)).toEqual([
        "b", "a",
      ]);
      expect(
        getTiebreakerLevel(byScore[0], byScore[1], [], new Map())
      ).toBe("Score");

      // Equal points + totalScores → point differential.
      const a = player("a", 2, 21);
      const b = player("b", 2, 21);
      const diffMatches = [
        match(1, ["a", "x"], ["y", "z"], 21, 10), // a diff +11
        match(2, ["p", "q"], ["b", "r"], 18, 21), // b diff +3
      ];
      expect(
        sortPlayersWithTiebreakers([a, b], diffMatches).map((item) => item.id)
      ).toEqual(["a", "b"]);
      expect(
        getTiebreakerLevel(a, b, diffMatches, new Map())
      ).toBe("Difference");

      // Equal everything through differential → head-to-head decides.
      const head = player("head", 2, 36);
      const other = player("other", 2, 36);
      const h2hMatches = [
        match(1, ["head", "x"], ["other", "y"], 21, 18), // head wins direct
        match(2, ["head", "x2"], ["s1", "s2"], 15, 15), // head diff +0 here
        match(3, ["o1", "o2"], ["other", "y2"], 12, 18), // other diff +6 here
      ];
      // head total diff = +3+0 = +3; other total diff = -3+6 = +3 → tied.
      expect(
        sortPlayersWithTiebreakers([other, head], h2hMatches).map(
          (item) => item.id
        )
      ).toEqual(["head", "other"]);
      expect(
        getTiebreakerLevel(head, other, h2hMatches, new Map())
      ).toBe("Head-to-head");

      // Equal through head-to-head → strength of opponents.
      const strong = player("strong", 2, 21);
      const weak = player("weak", 2, 21);
      const strengthMatches = [
        match(1, ["strong", "x"], ["high", "y"], 21, 10),
        match(2, ["low", "z"], ["weak", "w"], 10, 21),
      ];
      const points = new Map<string, number>([
        ["strong", 2],
        ["weak", 2],
        ["high", 10],
        ["y", 0],
        ["low", 0],
        ["z", 0],
      ]);
      expect(comparePlayers(strong, weak, strengthMatches, points)).toBeLessThan(0);
      expect(
        getTiebreakerLevel(strong, weak, strengthMatches, points)
      ).toBe("Opponents");

      // Fully tied → lexicographically smallest id wins.
      const first = player("aaa", 2, 21);
      const last = player("zzz", 2, 21);
      expect(sortPlayersWithTiebreakers([last, first], []).map((i) => i.id)).toEqual([
        "aaa", "zzz",
      ]);
      expect(getTiebreakerLevel(first, last, [], new Map())).toBe("Final rule");
      expect(comparePlayers(first, last, [], new Map())).toBeLessThan(0);
    });

    it("stays deterministic regardless of input order", () => {
      const list = [
        player("d", 2, 15),
        player("a", 3, 10),
        player("c", 2, 15),
        player("b", 1, 20),
      ];
      const once = sortPlayersWithTiebreakers(list, []).map((item) => item.id);
      const reversed = sortPlayersWithTiebreakers([...list].reverse(), []).map(
        (item) => item.id
      );
      expect(once).toEqual(reversed);
    });
  });

  describe("ranking reveal gate is unchanged", () => {
    it("still hides names until the first result is submitted", () => {
      expect(RANKINGS_REVEAL_MATCHES).toBe(1);
      expect(areRankingsVisible([])).toBe(false);
      expect(areRankingsVisible([{ isSubmitted: false, score1: 0, score2: 0 }])).toBe(
        false
      );
      expect(areRankingsVisible([{ isSubmitted: true, score1: 21, score2: 18 }])).toBe(
        true
      );
    });
  });
});
