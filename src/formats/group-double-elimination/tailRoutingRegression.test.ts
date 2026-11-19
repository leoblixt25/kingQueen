import { describe, expect, it } from "vitest";
import {
  GAME_IDS_16,
  getGameNumber,
} from "./gameNumbers";
import {
  buildSeedOrder,
  generateDoubleEliminationBracket,
  GRAND_FINAL_ONE_ID,
  GRAND_FINAL_TWO_ID,
  listEliminationMatches,
  loserMatchId,
  winnerMatchId,
} from "./bracket";
import {
  advanceEliminationMatch,
  getEliminationChampion,
  getEliminationLossCount,
  getEliminationWinCount,
  needsGrandFinalReset,
} from "./progression";
import {
  calculateFinalPlacements,
  validateFinalPlacements,
} from "./eliminationStandings";
import {
  recomputeBracketFromResults,
  selectCompletion,
  selectProgress,
} from "./scoring";
import { createGsdeTournamentDocument } from "./persistence";
import type { EliminationBracket, TeamId } from "./types";
import { STATUS_LABEL } from "../../pages/formats/group-double-elimination/shared";

const teamIds: TeamId[] = Array.from({ length: 16 }, (_, index) => `t${index + 1}`);
const makeBracket = (): EliminationBracket =>
  generateDoubleEliminationBracket(teamIds).bracket;

const byId = (bracket: EliminationBracket) =>
  new Map(listEliminationMatches(bracket).map((match) => [match.id, match]));

const gameById = (bracket: EliminationBracket, game: number) => {
  const match = listEliminationMatches(bracket).find((m) => getGameNumber(m.id) === game);
  if (!match) throw new Error(`Game ${game} is not in the bracket.`);
  return match;
};

/** Play every ready game, choosing a winner with `choose`. */
const simulate = (
  initial: EliminationBracket,
  choose: (matchId: string, teamAId: TeamId, teamBId: TeamId) => TeamId,
  stopWhen?: (bracket: EliminationBracket) => boolean
): EliminationBracket => {
  let bracket = initial;
  for (let pass = 0; pass < 40; pass += 1) {
    if (stopWhen?.(bracket)) return bracket;
    let progressed = false;
    for (const match of listEliminationMatches(bracket)) {
      if (stopWhen?.(bracket)) return bracket;
      if (
        match.status === "completed" ||
        match.teamAId === null ||
        match.teamBId === null
      ) {
        continue;
      }
      const winnerId = choose(match.id, match.teamAId, match.teamBId);
      const loserId = winnerId === match.teamAId ? match.teamBId : match.teamAId;
      bracket = advanceEliminationMatch(bracket, {
        matchId: match.id,
        winnerId,
        loserId,
        scoreA: winnerId === match.teamAId ? 21 : 10,
        scoreB: winnerId === match.teamBId ? 21 : 10,
      }).bracket;
      progressed = true;
    }
    if (!progressed) break;
  }
  return bracket;
};

const higherSeed = (matchId: string, a: TeamId, b: TeamId): TeamId => {
  void matchId;
  const seed = (team: TeamId) => Number(team.slice(1));
  return seed(a) < seed(b) ? a : b;
};

describe("fixed-16 tail routing (games 1-31)", () => {
  it("wires every game's feeder sources and winner/loser destinations", () => {
    const bracket = makeBracket();
    const matches = byId(bracket);
    const link = (
      from: string,
      kind: "winnerTo" | "loserTo",
      to: string,
      slot: "teamA" | "teamB"
    ) => {
      expect(matches.get(from)?.[kind], `${from} ${kind}`).toMatchObject({
        matchId: to,
        slot,
      });
    };

    const order = buildSeedOrder(16);
    const slotFor = (index: number): "teamA" | "teamB" =>
      index % 2 === 1 ? "teamA" : "teamB";

    // Games 1-8: WB R1, seeds 1v16 / 8v9 / 4v13 / 5v12 / ...
    for (let game = 1; game <= 8; game += 1) {
      const match = gameById(bracket, game);
      expect(match.teamAId).toBe(`t${order[(game - 1) * 2]}`);
      expect(match.teamBId).toBe(`t${order[(game - 1) * 2 + 1]}`);
      link(match.id, "winnerTo", winnerMatchId(2, Math.ceil(game / 2)), slotFor(game));
      link(match.id, "loserTo", loserMatchId(1, Math.ceil(game / 2)), slotFor(game));
    }

    // Games 9-12 -> WB R3 (21/22) and LB R2 (17-20).
    for (let game = 9; game <= 12; game += 1) {
      const index = game - 8;
      const match = gameById(bracket, game);
      link(winnerMatchId(1, index * 2 - 1), "winnerTo", match.id, "teamA");
      link(winnerMatchId(1, index * 2), "winnerTo", match.id, "teamB");
      link(match.id, "winnerTo", winnerMatchId(3, Math.ceil(index / 2)), slotFor(index));
      link(match.id, "loserTo", loserMatchId(2, index), "teamB");
    }

    // Games 13-16: LB R1 is fed by the losers of WB R1 (games 1-8).
    for (let game = 13; game <= 16; game += 1) {
      const index = game - 12;
      const match = gameById(bracket, game);
      link(winnerMatchId(1, index * 2 - 1), "loserTo", match.id, "teamA");
      link(winnerMatchId(1, index * 2), "loserTo", match.id, "teamB");
      link(match.id, "winnerTo", loserMatchId(2, index), "teamA");
      expect(match.loserTo).toBeNull();
    }

    // Games 17-20: LB R2 -> LB R3 (23/24).
    for (let game = 17; game <= 20; game += 1) {
      const index = game - 16;
      const match = gameById(bracket, game);
      link(loserMatchId(1, index), "winnerTo", match.id, "teamA");
      link(winnerMatchId(2, index), "loserTo", match.id, "teamB");
      link(match.id, "winnerTo", loserMatchId(3, Math.ceil(index / 2)), slotFor(index));
      expect(match.loserTo).toBeNull();
    }

    // Games 21-22: Winners R3 -> Game 27 (both) and Games 25/26 (losers).
    for (let game = 21; game <= 22; game += 1) {
      const index = game - 20;
      const match = gameById(bracket, game);
      link(winnerMatchId(2, index * 2 - 1), "winnerTo", match.id, "teamA");
      link(winnerMatchId(2, index * 2), "winnerTo", match.id, "teamB");
      link(match.id, "winnerTo", GAME_IDS_16.semiFinal1, index === 1 ? "teamA" : "teamB");
      link(match.id, "loserTo", loserMatchId(4, index), "teamB");
    }

    // Games 23-24: LB R3 -> Games 25/26.
    for (let game = 23; game <= 24; game += 1) {
      const index = game - 22;
      const match = gameById(bracket, game);
      link(loserMatchId(2, index * 2 - 1), "winnerTo", match.id, "teamA");
      link(loserMatchId(2, index * 2), "winnerTo", match.id, "teamB");
      link(match.id, "winnerTo", loserMatchId(4, index), "teamA");
      expect(match.loserTo).toBeNull();
    }

    // Games 25-26: W25/W26 feed Game 28, never the Winners Final.
    for (let game = 25; game <= 26; game += 1) {
      const index = game - 24;
      const match = gameById(bracket, game);
      link(loserMatchId(3, index), "winnerTo", match.id, "teamA");
      link(winnerMatchId(3, index), "loserTo", match.id, "teamB");
      link(match.id, "winnerTo", GAME_IDS_16.semiFinal2, index === 1 ? "teamA" : "teamB");
      expect(match.loserTo).toBeNull();
    }

    // Game 27 (Winners Final): W21 vs W22, winner to 30, loser to 29.
    const game27 = gameById(bracket, 27);
    expect(game27.id).toBe(GAME_IDS_16.semiFinal1);
    link(GAME_IDS_16.game21, "winnerTo", game27.id, "teamA");
    link(GAME_IDS_16.game22, "winnerTo", game27.id, "teamB");
    link(game27.id, "winnerTo", GRAND_FINAL_ONE_ID, "teamA");
    link(game27.id, "loserTo", GAME_IDS_16.lowerFinal, "teamB");

    // Game 28 (LB R5): W25 vs W26 -> Game 29.
    const game28 = gameById(bracket, 28);
    expect(game28.id).toBe(GAME_IDS_16.semiFinal2);
    link(GAME_IDS_16.game25, "winnerTo", game28.id, "teamA");
    link(GAME_IDS_16.game26, "winnerTo", game28.id, "teamB");
    link(game28.id, "winnerTo", GAME_IDS_16.lowerFinal, "teamA");
    expect(game28.loserTo).toBeNull();

    // Game 29 (LB Final): W28 vs L27 -> Game 30.
    const game29 = gameById(bracket, 29);
    expect(game29.id).toBe(GAME_IDS_16.lowerFinal);
    link(GAME_IDS_16.semiFinal2, "winnerTo", game29.id, "teamA");
    link(GAME_IDS_16.semiFinal1, "loserTo", game29.id, "teamB");
    link(game29.id, "winnerTo", GRAND_FINAL_ONE_ID, "teamB");
    expect(game29.loserTo).toBeNull();

    // Game 30: W27 vs W29, no further destination.
    const game30 = gameById(bracket, 30);
    expect(game30.id).toBe(GRAND_FINAL_ONE_ID);
    link(GAME_IDS_16.semiFinal1, "winnerTo", game30.id, "teamA");
    link(GAME_IDS_16.lowerFinal, "winnerTo", game30.id, "teamB");
    expect(game30.winnerTo).toBeNull();
    expect(game30.loserTo).toBeNull();

    // Game 31 exists only after the reset is triggered; its slots are copied
    // from Game 30 and it has no destinations.
    const reset = simulate(
      bracket,
      (matchId, a, b) => (matchId === GRAND_FINAL_ONE_ID ? b : higherSeed(matchId, a, b)),
      (candidate) => candidate.grandFinal.some((match) => match.round === 2)
    );
    const game31 = byId(reset).get(GRAND_FINAL_TWO_ID);
    expect(game31).toBeDefined();
    expect(getGameNumber(game31!.id)).toBe(31);
    const game30After = byId(reset).get(GRAND_FINAL_ONE_ID)!;
    expect(game31!.teamAId).toBe(game30After.teamAId);
    expect(game31!.teamBId).toBe(game30After.teamBId);
    expect(game31!.winnerTo).toBeNull();
    expect(game31!.loserTo).toBeNull();
  });

  it("higher-seed-wins tournament: every W-L record and placement", () => {
    const final = simulate(makeBracket(), higherSeed);
    const record = (team: number) => ({
      wins: getEliminationWinCount(final, `t${team}`),
      losses: getEliminationLossCount(final, `t${team}`),
    });

    expect(getEliminationChampion(final)).toBe("t1");
    expect(record(1)).toEqual({ wins: 5, losses: 0 });
    // Double-elimination invariant: every eliminated team has exactly two
    // losses (15 teams x 2 = 30 games = the full bracket).
    const expectedWins: Record<number, number> = {
      2: 4, 3: 4, 4: 3, 5: 3, 6: 3,
      7: 2, 8: 2,
      9: 1, 10: 1, 11: 1, 12: 1,
      13: 0, 14: 0, 15: 0, 16: 0,
    };
    for (let team = 2; team <= 16; team += 1) {
      expect(record(team), `team ${team}`).toEqual({
        wins: expectedWins[team],
        losses: 2,
      });
    }

    const places = new Map(
      calculateFinalPlacements(final).flatMap((placement) =>
        placement.teamIds.map((teamId) => [teamId, placement.place] as const)
      )
    );
    const expectedPlaces: Record<string, number> = {
      t1: 1,
      t2: 2,
      t3: 3,
      t4: 4,
      t5: 5,
      t6: 5,
      t7: 7,
      t8: 7,
      t9: 9,
      t10: 9,
      t11: 9,
      t12: 9,
      t13: 13,
      t14: 13,
      t15: 13,
      t16: 13,
    };
    expect(Object.fromEntries(places)).toEqual(expectedPlaces);
    expect(validateFinalPlacements(final, true).isConsistent).toBe(true);
    expect(listEliminationMatches(final)).toHaveLength(30);
  });

  it("creates Game 31 when the LB-side team wins Game 30", () => {
    const played = simulate(
      makeBracket(),
      (matchId, a, b) => (matchId === GRAND_FINAL_ONE_ID ? b : higherSeed(matchId, a, b)),
      (candidate) => candidate.grandFinal.some((match) => match.round === 2)
    );
    expect(needsGrandFinalReset(played)).toBe(true);
    expect(getEliminationChampion(played)).toBeNull();
    expect(byId(played).get(GRAND_FINAL_TWO_ID)?.teamAId).toBe("t1");
    expect(byId(played).get(GRAND_FINAL_TWO_ID)?.teamBId).toBe("t2");
    expect(listEliminationMatches(played)).toHaveLength(31);

    // Game 31 slots are copied from Game 30: A = t1, B = t2. A win by slot B
    // means the score must show B on 21.
    const decided = advanceEliminationMatch(played, {
      matchId: GRAND_FINAL_TWO_ID,
      winnerId: "t2",
      loserId: "t1",
      scoreA: 18,
      scoreB: 21,
    }).bracket;
    expect(getEliminationChampion(decided)).toBe("t2");
    expect(needsGrandFinalReset(decided)).toBe(false);
  });

  it("regression: Samuel/Martina vs Ethan/Clara, Mateo/Mia vs Andrés/Ava", () => {
    const names: Record<string, string> = {
      t1: "Samuel/Martina",
      t2: "Ethan/Clara",
      t5: "Mateo/Mia",
      t6: "Andrés/Ava",
    };
    const played = simulate(makeBracket(), (matchId, a, b) => {
      if (matchId === GAME_IDS_16.game25 && (a === "t5" || b === "t5")) return "t5";
      if (matchId === GAME_IDS_16.game26 && (a === "t6" || b === "t6")) return "t6";
      return higherSeed(matchId, a, b);
    });

    const match = byId(played);
    const game27 = match.get(GAME_IDS_16.semiFinal1)!;
    const game28 = match.get(GAME_IDS_16.semiFinal2)!;
    const game29 = match.get(GAME_IDS_16.lowerFinal)!;

    expect([game27.teamAId, game27.teamBId].map((id) => names[id!])).toEqual([
      "Samuel/Martina",
      "Ethan/Clara",
    ]);
    expect([game28.teamAId, game28.teamBId].map((id) => names[id!])).toEqual([
      "Mateo/Mia",
      "Andrés/Ava",
    ]);
    // Game 29 = Winner(Game 28) vs Loser(Game 27). The loser of Game 27 must
    // feed Game 29 (never a crossed Game 27/28 swap).
    expect(game29.teamAId).toBe("t5");
    expect(game29.teamBId).toBe(game27.loserId);
    expect(game29.teamBId).toBe("t2");
    expect(game29.winnerId).toBe("t2");
    expect(game29.loserId).toBe("t5");
  });

  it("recompute repairs a crossed saved bracket without losing results", () => {
    const final = simulate(makeBracket(), higherSeed);
    const doc = createGsdeTournamentDocument("repair");
    doc.elimination = final;
    doc.tournament.status = "elimination";

    // Simulate the old bug: the stored Games 27 and 28 have crossed
    // participants. Recompute must rebuild canonical routing from the saved
    // results (keyed by game id), never from the corrupted stored slots.
    const corrupted = JSON.parse(JSON.stringify(final)) as EliminationBracket;
    const g27 = corrupted.winners.find((match) => match.id === GAME_IDS_16.semiFinal1)!;
    const g28 = corrupted.losers.find((match) => match.id === GAME_IDS_16.semiFinal2)!;
    [g27.teamAId, g28.teamAId] = [g28.teamAId, g27.teamAId];
    [g27.teamBId, g28.teamBId] = [g28.teamBId, g27.teamBId];
    doc.elimination = corrupted;

    const repaired = recomputeBracketFromResults(doc);
    const match = byId(repaired.elimination!);
    expect([match.get(GAME_IDS_16.semiFinal1)!.teamAId, match.get(GAME_IDS_16.semiFinal1)!.teamBId])
      .toEqual(["t1", "t2"]);
    expect([match.get(GAME_IDS_16.semiFinal2)!.teamAId, match.get(GAME_IDS_16.semiFinal2)!.teamBId])
      .toEqual(["t4", "t3"]);
    expect(match.get(GAME_IDS_16.lowerFinal)!.teamBId).toBe("t2");
    expect(getEliminationChampion(repaired.elimination!)).toBe("t1");
    expect(listEliminationMatches(repaired.elimination!)).toHaveLength(30);
    expect(repaired.auditLog?.at(-1)?.action).toBe("bracket-recomputed");
  });

  it("Game 29 appears in the match list and status stays In progress until 29/30", () => {
    const played = simulate(
      makeBracket(),
      (matchId, a, b) => (matchId === GAME_IDS_16.lowerFinal ? a : higherSeed(matchId, a, b)),
      (bracket) => byId(bracket).get(GAME_IDS_16.lowerFinal)?.status === "completed"
    );

    // Same rule as AdminSetup's "Jump to match" list.
    const playableNumbers = listEliminationMatches(played)
      .filter((match) => match.teamAId !== null && match.teamBId !== null)
      .map((match) => getGameNumber(match.id));
    expect(playableNumbers).toContain(29);
    // Once Game 29 fills Game 30's second slot, Game 30 becomes playable too —
    // but it is still only "ready", so the tournament is not complete yet.
    expect(playableNumbers).toContain(30);
    expect(byId(played).get(GRAND_FINAL_ONE_ID)?.status).toBe("ready");

    const doc = createGsdeTournamentDocument("regression");
    doc.elimination = played;
    doc.tournament.status = "elimination";
    doc.tournament.groupStageVerified = true;

    expect(selectCompletion(doc).isComplete).toBe(false);
    expect(selectProgress(doc).eliminationTotal).toBe(30);
    expect(doc.tournament.status).not.toBe("completed");
    expect(STATUS_LABEL[doc.tournament.status]).toBe("In progress");

    const withGrandFinal = simulate(played, (matchId, a, b) => {
      if (matchId === GRAND_FINAL_ONE_ID) return a;
      return higherSeed(matchId, a, b);
    });
    doc.elimination = withGrandFinal;
    const gf = byId(withGrandFinal).get(GRAND_FINAL_ONE_ID);
    expect(gf?.status).toBe("completed");
    expect(getEliminationChampion(withGrandFinal)).not.toBeNull();
    expect(selectProgress(doc).eliminationTotal).toBe(30);
  });
});
