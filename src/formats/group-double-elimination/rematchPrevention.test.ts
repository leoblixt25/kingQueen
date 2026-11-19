import { describe, expect, it } from "vitest";
import type { EliminationBracket, MatchId, TeamId } from "./types";
import {
  findEliminationMatch,
  generateDoubleEliminationBracket,
} from "./bracket";
import {
  advanceEliminationMatch,
  type EliminationAdvanceOptions,
} from "./progression";
import {
  getPlayedOpponents,
  teamsHavePlayed,
  chooseRematchSafeDrop,
} from "./rematchPrevention";

const AVOID: EliminationAdvanceOptions = { avoidRematches: true };

const matchFor = (bracket: EliminationBracket, id: MatchId) => {
  const match = findEliminationMatch(bracket, id);
  if (!match) throw new Error(`Missing ${id}`);
  return match;
};

const play = (
  bracket: EliminationBracket,
  id: MatchId,
  winnerId: TeamId,
  options: EliminationAdvanceOptions = AVOID
): EliminationBracket => {
  const match = matchFor(bracket, id);
  const loserId = match.teamAId === winnerId ? match.teamBId : match.teamAId;
  if (!loserId) throw new Error(`${id} has no opponent`);

  return advanceEliminationMatch(
    bracket,
    { matchId: id, winnerId, loserId },
    options
  ).bracket;
};

/** Reaches the point where s1's first loss would be an immediate rematch. */
const setupRematchScenario = (
  options: EliminationAdvanceOptions = AVOID
): EliminationBracket => {
  const seeds = Array.from({ length: 8 }, (_, index) => `s${index + 1}`);
  let bracket = generateDoubleEliminationBracket(seeds).bracket;

  // Winners Round 1: s1, s5, s2 and s3 advance.
  bracket = play(bracket, "winners-r1-m1", "s1", options);
  bracket = play(bracket, "winners-r1-m2", "s5", options);
  bracket = play(bracket, "winners-r1-m3", "s2", options);
  bracket = play(bracket, "winners-r1-m4", "s3", options);

  // Losers Round 1: s8 and s7 come through, so s8 waits for the WB R2 drop.
  bracket = play(bracket, "losers-r1-m1", "s8", options);
  bracket = play(bracket, "losers-r1-m2", "s7", options);

  return bracket;
};

describe("rematch-safe loser drops", () => {
  it("detects opponents that have already met", () => {
    const bracket = setupRematchScenario();

    expect(getPlayedOpponents(bracket, "s1").has("s8")).toBe(true);
    expect(teamsHavePlayed(bracket, "s1", "s8")).toBe(true);
    expect(teamsHavePlayed(bracket, "s1", "s7")).toBe(false);
  });

  it("keeps canonical loser routing even when a rematch is possible", () => {
    const before = setupRematchScenario();

    expect(matchFor(before, "losers-r2-m1").teamBId).toBeNull();
    expect(matchFor(before, "losers-r2-m2").teamBId).toBeNull();
    expect(matchFor(before, "losers-r2-m1").teamAId).toBe("s8");
    expect(matchFor(before, "losers-r2-m2").teamAId).toBe("s7");

    // The standalone legacy helper still detects that s1 would meet s8 again.
    const drop = chooseRematchSafeDrop(before, "winners-r2-m1", "s1");
    expect(drop.redirected).toBe(true);
    expect(drop.link).toEqual({ matchId: "losers-r2-m2", slot: "teamB" });

    // The operational engine, however, always uses the canonical links from
    // bracket.ts; avoidRematches is no longer wired into advancement.
    const after = play(before, "winners-r2-m1", "s5");
    expect(matchFor(after, "losers-r2-m1").teamBId).toBe("s1");
    expect(matchFor(after, "losers-r2-m2").teamBId).toBeNull();
    expect(matchFor(after, "winners-r2-m1").loserTo).toEqual({
      matchId: "losers-r2-m1",
      slot: "teamB",
    });
  });

  it("keeps canonical routing when no rematch is possible", () => {
    const before = setupRematchScenario();
    const drop = chooseRematchSafeDrop(before, "winners-r2-m2", "s3");

    expect(drop.redirected).toBe(false);
    expect(drop.link).toEqual({ matchId: "losers-r2-m2", slot: "teamB" });
  });

  it("keeps a valid bracket shape with the avoidance option present", () => {
    let bracket = setupRematchScenario();
    bracket = play(bracket, "winners-r2-m1", "s5");
    bracket = play(bracket, "winners-r2-m2", "s2");
    bracket = play(bracket, "losers-r2-m1", "s8");
    bracket = play(bracket, "losers-r2-m2", "s7");

    for (const match of [
      ...bracket.winners,
      ...bracket.losers,
      ...bracket.grandFinal,
    ]) {
      if (
        match.status !== "completed" ||
        !match.teamAId ||
        !match.teamBId
      ) {
        continue;
      }
      expect(teamsHavePlayed(bracket, match.teamAId, match.teamBId)).toBe(true);
    }

    // Every completed match is still legitimate: no team appears twice in a
    // match and the bracket links stay unique.
    const links = [
      ...bracket.winners,
      ...bracket.losers,
      ...bracket.grandFinal,
    ].flatMap((match) =>
      [match.winnerTo, match.loserTo]
        .filter(Boolean)
        .map((link) => `${link?.matchId}:${link?.slot}`)
    );
    expect(new Set(links).size).toBe(links.length);
  });

  it("remains deterministic for the same completion order", () => {
    const first = play(setupRematchScenario(), "winners-r2-m1", "s5");
    const second = play(setupRematchScenario(), "winners-r2-m1", "s5");

    expect(first).toEqual(second);
  });
});
