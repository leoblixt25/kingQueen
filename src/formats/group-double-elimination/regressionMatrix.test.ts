import { describe, expect, it } from "vitest";
import type {
  EliminationMatch,
  Team,
  TeamId,
} from "./types";
import {
  createGsdeTournamentDocument,
  fromGsdeFirestoreData,
  gsdeTournamentPath,
  toGsdeFirestoreData,
  type GsdeTournamentDocument,
} from "./persistence";
import {
  buildTeamsAndGroups,
  generateEliminationBracket,
  scoreEliminationMatch,
  scoreGroupMatch,
  selectFinalResult,
  verifyGroupStageCompletion,
} from "./scoring";
import { calculateAllGroupStandings } from "./groupStandings";
import { calculateEliminationStandings } from "./eliminationStandings";
import {
  getEliminationChampion,
  getEliminationLossCount,
  needsGrandFinalReset,
} from "./progression";
import { listEliminationMatches } from "./bracket";
import { getGameNumber } from "./gameNumbers";
import { buildPlayerView } from "./playerView";

/**
 * Phase 11 end-to-end regression matrix for the NEW format. Each scenario is
 * run from a clean generated tournament through the real scoring service so a
 * future change cannot silently break one of the accepted behaviours.
 */

const makeTeams = (prefix = "t"): Team[] =>
  Array.from({ length: 16 }, (_, index) => ({
    id: `${prefix}${index + 1}`,
    name: `Team ${prefix}${index + 1}`,
    playerIds: [],
    seed: index + 1,
    groupId: null,
  }));

const ready = (id = "event-1", prefix = "t") =>
  buildTeamsAndGroups(
    createGsdeTournamentDocument(id),
    makeTeams(prefix)
  );

/** Score all 24 group matches; `winnerA` picks the winner of each match. */
const playAllGroups = (
  doc: GsdeTournamentDocument,
  winnerA: (match: GsdeTournamentDocument["matches"][number]) => boolean = () => true
): GsdeTournamentDocument => {
  let current = doc;
  for (const match of [...current.matches]) {
    const aWins = winnerA(match);
    current = scoreGroupMatch(
      current,
      match.id,
      aWins ? 21 : 10,
      aWins ? 10 : 21
    );
  }
  return current;
};

type WinnerPolicy = (
  match: EliminationMatch,
  doc: GsdeTournamentDocument,
  losses: (teamId: TeamId) => number
) => TeamId;

/** Play elimination matches in game-number order until no more are ready. */
const runElimination = (
  start: GsdeTournamentDocument,
  policy: WinnerPolicy,
  stopWhen?: (doc: GsdeTournamentDocument) => boolean
): GsdeTournamentDocument => {
  let doc = start;
  for (let step = 0; step < 60; step += 1) {
    if (stopWhen?.(doc)) break;
    const bracket = doc.elimination!;
    const match = listEliminationMatches(bracket)
      .filter(
        (item) =>
          item.status !== "completed" && item.teamAId && item.teamBId
      )
      .sort(
        (a, b) =>
          (getGameNumber(a.id) ?? 999) - (getGameNumber(b.id) ?? 999)
      )[0];
    if (!match) break;
    const winnerId = policy(match, doc, (teamId) =>
      getEliminationLossCount(bracket, teamId)
    );
    const loserId =
      winnerId === match.teamAId ? match.teamBId! : match.teamAId!;
    doc = scoreEliminationMatch(doc, {
      matchId: match.id,
      winnerId,
      loserId,
      scoreA: winnerId === match.teamAId ? 21 : 10,
      scoreB: winnerId === match.teamBId ? 21 : 10,
    });
  }
  return doc;
};

/** Undefeated (fewer-loss) finalist wins; used for a no-reset championship. */
const fewerLossesWins: WinnerPolicy = (match, _doc, losses) =>
  losses(match.teamAId!) <= losses(match.teamBId!)
    ? match.teamAId!
    : match.teamBId!;

/**
 * The first semifinal is won by its undefeated (fewer-loss) finalist and the
 * second by its one-loss (more-loss) finalist, producing the classic
 * undefeated-vs-one-loss Grand Final.
 */
const classicFinalPolicy: WinnerPolicy = (match, doc, losses) => {
  const game = getGameNumber(match.id);
  if (game === 27) return fewerLossesWins(match, doc, losses);
  if (game === 28) {
    return losses(match.teamAId!) >= losses(match.teamBId!)
      ? match.teamAId!
      : match.teamBId!;
  }
  return fewerLossesWins(match, doc, losses);
};

describe("Phase 11 regression matrix — new format", () => {
  it("generates groups with 24 unique round-robin matches", () => {
    const doc = ready();
    expect(doc.groups).toHaveLength(4);
    expect(doc.groups.every((group) => group.teamIds.length === 4)).toBe(true);
    expect(doc.matches).toHaveLength(24);
    expect(new Set(doc.matches.map((match) => match.id)).size).toBe(24);

    for (const group of doc.groups) {
      const matches = doc.matches.filter((match) => match.groupId === group.id);
      expect(matches).toHaveLength(6);
      const pairs = new Set(
        matches.map((match) => [match.teamAId, match.teamBId].sort().join("|"))
      );
      expect(pairs.size).toBe(6);
      expect(group.teamIds.every((id) => id)).toBe(true);
    }
  });

  it("completing the group stage produces correct standings and ranking", () => {
    const doc = playAllGroups(ready());
    const check = verifyGroupStageCompletion(doc);
    expect(check.isComplete).toBe(true);
    expect(check.completed).toBe(24);
    expect(check.total).toBe(24);

    const global = check.ranking;
    expect(global).toHaveLength(16);
    expect(global.map((row) => row.globalRank)).toEqual(
      Array.from({ length: 16 }, (_, index) => index + 1)
    );
    expect(global.reduce((sum, row) => sum + row.wins, 0)).toBe(24);
    expect(global.reduce((sum, row) => sum + row.losses, 0)).toBe(24);
    expect(global.every((row) => row.wins + row.losses === 3)).toBe(true);

    const tables = calculateAllGroupStandings(doc.groups, doc.matches);
    expect(tables).toHaveLength(4);
    expect(tables.every((table) => table.rows.every((row) => row.qualified))).toBe(true);
  });

  it("a team that loses all three group matches still qualifies", () => {
    const loseTeamId = "t16";
    const doc = playAllGroups(ready(), (match) =>
      match.teamAId === loseTeamId ? false : match.teamBId === loseTeamId ? true : true
    );
    const tables = calculateAllGroupStandings(doc.groups, doc.matches);
    const row = tables.flatMap((table) => table.rows).find(
      (item) => item.teamId === loseTeamId
    );

    expect(row).toMatchObject({ losses: 3, wins: 0, qualified: true });
    expect(verifyGroupStageCompletion(doc).ranking.some(
      (item) => item.teamId === loseTeamId
    )).toBe(true);
  });

  it("every team starts the elimination bracket with zero losses", () => {
    const doc = generateEliminationBracket(playAllGroups(ready()));
    for (const team of doc.teams) {
      expect(getEliminationLossCount(doc.elimination!, team.id)).toBe(0);
    }
  });

  it("the first elimination loss moves a team to the Losers bracket", () => {
    let doc = generateEliminationBracket(playAllGroups(ready()));
    const match = listEliminationMatches(doc.elimination!).find(
      (item) => item.status === "ready" && item.teamAId && item.teamBId
    )!;
    const loserId = match.teamBId!;
    doc = scoreEliminationMatch(doc, {
      matchId: match.id,
      winnerId: match.teamAId!,
      loserId,
    });

    const standing = calculateEliminationStandings(doc.elimination!).find(
      (row) => row.teamId === loserId
    )!;
    expect(getEliminationLossCount(doc.elimination!, loserId)).toBe(1);
    expect(standing.status).toBe("losers");
  });

  it("the second elimination loss eliminates the team", () => {
    const victim = "t16";
    // The victim loses every match it plays; all other matches resolve by the
    // fewer-loss rule so brackets feed forward without stalling.
    const doc = runElimination(
      generateEliminationBracket(playAllGroups(ready())),
      (match, d, losses) =>
        match.teamAId === victim
          ? match.teamBId!
          : match.teamBId === victim
            ? match.teamAId!
            : fewerLossesWins(match, d, losses),
      (current) => getEliminationLossCount(current.elimination!, victim) >= 2
    );

    const standing = calculateEliminationStandings(doc.elimination!).find(
      (row) => row.teamId === victim
    )!;
    expect(getEliminationLossCount(doc.elimination!, victim)).toBe(2);
    expect(standing.status).toBe("eliminated");
    expect(standing.eliminatedByMatchId).not.toBeNull();
  });

  it("the Grand Final produces the correct champion with no reset when the undefeated finalist wins", () => {
    const bracketReady = generateEliminationBracket(playAllGroups(ready()));
    const doc = runElimination(bracketReady, (match, d, losses) => {
      const game = getGameNumber(match.id);
      if (game === 27 || game === 28) {
        return classicFinalPolicy(match, d, losses);
      }
      // Grand Final: fewer-loss (undefeated) finalist wins → no reset.
      if (game === 30) return fewerLossesWins(match, d, losses);
      return fewerLossesWins(match, d, losses);
    });

    const finalists = listEliminationMatches(doc.elimination!).find(
      (match) => getGameNumber(match.id) === 30
    )!;
    const expectedChampion = (() => {
      const aLosses = getEliminationLossCount(doc.elimination!, finalists.teamAId!);
      const bLosses = getEliminationLossCount(doc.elimination!, finalists.teamBId!);
      return aLosses <= bLosses ? finalists.teamAId! : finalists.teamBId!;
    })();

    expect(doc.tournament.status).toBe("completed");
    expect(needsGrandFinalReset(doc.elimination!)).toBe(false);
    expect(getEliminationChampion(doc.elimination!)).toBe(expectedChampion);
    expect(selectFinalResult(doc).championTeamIds).toEqual([expectedChampion]);
  });

  it("a Reset Final is added and decides the champion when the undefeated finalist loses the first Grand Final", () => {
    const bracketReady = generateEliminationBracket(playAllGroups(ready()));

    // Play every match except the Grand Finals, arranging the classic
    // undefeated-vs-one-loss final pairing.
    let doc = runElimination(
      bracketReady,
      classicFinalPolicy,
      (current) =>
        listEliminationMatches(current.elimination!).some(
          (match) => getGameNumber(match.id) === 30 && match.status === "ready"
        )
    );

    const grandFinal = listEliminationMatches(doc.elimination!).find(
      (match) => getGameNumber(match.id) === 30
    )!;
    expect(grandFinal.status).toBe("ready");
    const lossA = getEliminationLossCount(doc.elimination!, grandFinal.teamAId!);
    const lossB = getEliminationLossCount(doc.elimination!, grandFinal.teamBId!);
    // Classic final: one finalist is undefeated (0), the other has one loss.
    expect([lossA, lossB].sort()).toEqual([0, 1]);
    const undefeated =
      lossA < lossB ? grandFinal.teamAId! : grandFinal.teamBId!;
    const oneLoss =
      lossA < lossB ? grandFinal.teamBId! : grandFinal.teamAId!;

    // The one-loss finalist wins the first Grand Final, handing the undefeated
    // finalist its FIRST loss — which must trigger the reset.
    doc = scoreEliminationMatch(doc, {
      matchId: grandFinal.id,
      winnerId: oneLoss,
      loserId: undefeated,
      scoreA: grandFinal.teamAId === oneLoss ? 21 : 10,
      scoreB: grandFinal.teamBId === oneLoss ? 21 : 10,
    });

    expect(needsGrandFinalReset(doc.elimination!)).toBe(true);
    expect(getEliminationChampion(doc.elimination!)).toBeNull();
    expect(doc.tournament.status).toBe("grand-final");

    const resetMatch = listEliminationMatches(doc.elimination!).find(
      (match) => getGameNumber(match.id) === 31
    )!;
    expect(resetMatch.status).toBe("ready");
    doc = scoreEliminationMatch(doc, {
      matchId: resetMatch.id,
      winnerId: undefeated,
      loserId: oneLoss,
      scoreA: resetMatch.teamAId === undefeated ? 21 : 10,
      scoreB: resetMatch.teamBId === undefeated ? 21 : 10,
    });

    expect(getEliminationChampion(doc.elimination!)).toBe(undefeated);
    expect(selectFinalResult(doc).championTeamIds).toEqual([undefeated]);
    expect(doc.tournament.status).toBe("completed");
    expect(needsGrandFinalReset(doc.elimination!)).toBe(false);
  });

  it("keeps state correct across a save/refresh (Firestore round-trip)", () => {
    let doc = generateEliminationBracket(playAllGroups(ready()));
    const victim = "t16";
    const match = listEliminationMatches(doc.elimination!)
      .filter(
        (item) =>
          item.status === "ready" &&
          (item.teamAId === victim || item.teamBId === victim)
      )
      .sort((a, b) => a.round - b.round)[0];
    doc = scoreEliminationMatch(doc, {
      matchId: match.id,
      winnerId: match.teamAId === victim ? match.teamBId! : match.teamAId!,
      loserId: victim,
    });

    const restored = fromGsdeFirestoreData(
      toGsdeFirestoreData(doc),
      doc.id
    )!;
    expect(restored).toEqual(doc);

    // Every derived view must be identical after a refresh.
    expect(verifyGroupStageCompletion(restored)).toEqual(
      verifyGroupStageCompletion(doc)
    );
    expect(calculateAllGroupStandings(restored.groups, restored.matches)).toEqual(
      calculateAllGroupStandings(doc.groups, doc.matches)
    );
    expect(calculateEliminationStandings(restored.elimination!)).toEqual(
      calculateEliminationStandings(doc.elimination!)
    );
    expect(buildPlayerView(restored, victim)).toEqual(buildPlayerView(doc, victim));
    expect(needsGrandFinalReset(restored.elimination!)).toBe(
      needsGrandFinalReset(doc.elimination!)
    );
  });

  it("keeps multiple tournaments fully isolated with no data crossover", () => {
    const docA = playAllGroups(ready("event-a", "a"), () => true);
    const docB = playAllGroups(ready("event-b", "b"), () => false);

    expect(gsdeTournamentPath(docA.id)).toBe("tournaments/event-a");
    expect(gsdeTournamentPath(docB.id)).toBe("tournaments/event-b");

    const dataA = toGsdeFirestoreData(docA);
    const dataB = toGsdeFirestoreData(docB);
    const restoredA = fromGsdeFirestoreData(dataA, docA.id)!;
    const restoredB = fromGsdeFirestoreData(dataB, docB.id)!;

    expect(restoredA.id).toBe("event-a");
    expect(restoredB.id).toBe("event-b");
    expect(restoredA.teams.map((team) => team.id)).toEqual(
      makeTeams("a").map((team) => team.id)
    );
    expect(restoredB.teams.map((team) => team.id)).toEqual(
      makeTeams("b").map((team) => team.id)
    );
    // Different scoring policies must produce different standings per event.
    expect(verifyGroupStageCompletion(restoredA).ranking).not.toEqual(
      verifyGroupStageCompletion(restoredB).ranking
    );
    expect(
      restoredA.auditLog ?? []
    ).not.toBe(restoredB.auditLog);
  });
});
