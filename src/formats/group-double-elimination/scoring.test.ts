import { describe, expect, it } from "vitest";
import type { GroupStageMatch, Team } from "./types";
import {
  createGsdeTournamentDocument,
  type GsdeTournamentDocument,
} from "./persistence";
import {
  buildTeamsAndGroups,
  correctEliminationResult,
  correctGroupMatchScore,
  generateEliminationBracket,
  scoreEliminationMatch,
  scoreGroupMatch,
  selectGlobalRanking,
  selectGroupStandings,
  selectLossCount,
  selectPlacements,
  ScoringError,
} from "./scoring";
import { findEliminationMatch, listEliminationMatches } from "./bracket";
import { GAME_IDS_16 } from "./gameNumbers";

const makeTeams = (): Team[] =>
  Array.from({ length: 16 }, (_, index) => ({
    id: `t${index + 1}`,
    name: `Team ${index + 1}`,
    playerIds: [],
    seed: index + 1,
    groupId: null,
  }));

const readyDoc = (): GsdeTournamentDocument =>
  buildTeamsAndGroups(createGsdeTournamentDocument("event-1"), makeTeams());

/** Better seed wins each group match. */
const playGroups = (doc: GsdeTournamentDocument): GsdeTournamentDocument => {
  const seeds = new Map(doc.teams.map((team) => [team.id, team.seed ?? 99]));
  let current = doc;

  for (const match of [...doc.matches]) {
    const scoreA = (seeds.get(match.teamAId) ?? 99) < (seeds.get(match.teamBId) ?? 99) ? 21 : 10;
    current = scoreGroupMatch(
      current,
      match.id,
      scoreA,
      scoreA === 21 ? 10 : 21
    );
  }

  return current;
};

const capture = (action: () => unknown): ScoringError => {
  try {
    action();
  } catch (error) {
    if (error instanceof ScoringError) return error;
    throw error;
  }
  throw new Error("Expected a ScoringError");
};

describe("group scoring service", () => {
  it("builds 16 teams, 4 groups and 24 matches", () => {
    const doc = readyDoc();

    expect(doc.teams).toHaveLength(16);
    expect(doc.groups).toHaveLength(4);
    expect(doc.matches).toHaveLength(24);
    expect(doc.tournament.status).toBe("configured");
  });

  it("updates standings and global ranking from scores", () => {
    let doc = readyDoc();
    const first = doc.matches[0];
    doc = scoreGroupMatch(doc, first.id, 21, 7);

    const updated = doc.matches.find((match) => match.id === first.id);
    expect(updated).toMatchObject({
      status: "completed",
      winnerId: first.teamAId,
      scoreA: 21,
      scoreB: 7,
    });

    const standings = selectGroupStandings(doc);
    expect(standings).toHaveLength(4);
    expect(standings[0].rows.some((row) => row.wins === 1)).toBe(true);

    const ranking = selectGlobalRanking(doc);
    expect(ranking).toHaveLength(16);
    expect(ranking[0].teamId).toBe(first.teamAId);
  });

  it("rejects invalid and duplicate scores", () => {
    const doc = readyDoc();
    const first = doc.matches[0];

    expect(capture(() => scoreGroupMatch(doc, first.id, 10, 10)).code).toBe(
      "invalid-score"
    );
    expect(capture(() => scoreGroupMatch(doc, "missing", 21, 10)).code).toBe(
      "unknown-match"
    );

    const scored = scoreGroupMatch(doc, first.id, 21, 10);
    expect(capture(() => scoreGroupMatch(scored, first.id, 21, 5)).code).toBe(
      "match-completed"
    );
  });

  it("gates bracket generation on all 24 group matches", () => {
    let doc = readyDoc();
    expect(capture(() => generateEliminationBracket(doc)).code).toBe(
      "group-stage-incomplete"
    );

    for (const match of doc.matches.slice(0, 23)) {
      doc = scoreGroupMatch(doc, match.id, 21, 10);
    }
    expect(capture(() => generateEliminationBracket(doc)).code).toBe(
      "group-stage-incomplete"
    );

    const last = doc.matches[23];
    doc = scoreGroupMatch(doc, last.id, 21, 10);
    expect(() => generateEliminationBracket(doc)).not.toThrow();
  });
});

describe("elimination scoring service", () => {
  const makeEliminationDoc = () => generateEliminationBracket(playGroups(readyDoc()));

  it("generates the standard 16-team bracket", () => {
    const doc = makeEliminationDoc();

    expect(doc.elimination).not.toBeNull();
    expect(doc.elimination?.seededTeamIds).toHaveLength(16);
    expect(doc.elimination?.bracketSize).toBe(16);
    expect(doc.tournament.status).toBe("elimination");
  });

  it("auto-advances the winner and drops the loser", () => {
    const doc = makeEliminationDoc();
    const match = findEliminationMatch(doc.elimination!, "winners-r1-m1")!;
    const winnerId = match.teamAId!;
    const loserId = match.teamBId!;

    const next = scoreEliminationMatch(doc, {
      matchId: match.id,
      winnerId,
      loserId,
    });

    const completed = findEliminationMatch(next.elimination!, match.id);
    expect(completed?.status).toBe("completed");
    expect(completed?.winnerId).toBe(winnerId);
    expect(selectLossCount(next, loserId)).toBe(1);
    expect(selectLossCount(next, winnerId)).toBe(0);
  });

  it("blocks invalid and duplicate elimination results", () => {
    const doc = makeEliminationDoc();
    const match = findEliminationMatch(doc.elimination!, "winners-r1-m1")!;

    expect(
      capture(() =>
        scoreEliminationMatch(doc, {
          matchId: match.id,
          winnerId: "not-in-match",
          loserId: match.teamAId!,
        })
      ).code
    ).toBe("invalid-score");

    const scored = scoreEliminationMatch(doc, {
      matchId: match.id,
      winnerId: match.teamAId!,
      loserId: match.teamBId!,
    });
    expect(
      capture(() =>
        scoreEliminationMatch(scored, {
          matchId: match.id,
          winnerId: match.teamAId!,
          loserId: match.teamBId!,
        })
      ).code
    ).toBe("match-completed");
  });

  it("marks the bracket locked for group corrections after elimination starts", () => {
    const doc = makeEliminationDoc();
    const match = findEliminationMatch(doc.elimination!, "winners-r1-m1")!;
    const scored = scoreEliminationMatch(doc, {
      matchId: match.id,
      winnerId: match.teamAId!,
      loserId: match.teamBId!,
    });

    expect(
      capture(() =>
        correctGroupMatchScore(scored, scored.matches[0].id, 21, 5)
      ).code
    ).toBe("bracket-locked");
  });
});

describe("corrections and recalculation", () => {
  const makeEliminationDoc = () => generateEliminationBracket(playGroups(readyDoc()));

  it("recalculates a corrected group score when no elimination result exists", () => {
    const doc = makeEliminationDoc();
    const target = doc.matches[0];
    const corrected = correctGroupMatchScore(doc, target.id, 1, 21);

    expect(corrected.elimination).toBeNull();
    expect(corrected.tournament.seedingStale).toBe(true);
    expect(
      selectGroupStandings(corrected)[0].rows.find((row) => row.teamId === target.teamAId)?.losses
    ).toBe(1);
  });

  it("replays elimination results after a correction", () => {
    let doc = makeEliminationDoc();
    const first = findEliminationMatch(doc.elimination!, "winners-r1-m1")!;
    const second = findEliminationMatch(doc.elimination!, "winners-r1-m2")!;

    doc = scoreEliminationMatch(doc, {
      matchId: first.id,
      winnerId: first.teamAId!,
      loserId: first.teamBId!,
      scoreA: 21,
      scoreB: 10,
    });
    doc = scoreEliminationMatch(doc, {
      matchId: second.id,
      winnerId: second.teamAId!,
      loserId: second.teamBId!,
      scoreA: 21,
      scoreB: 8,
    });

    // Correct the first result: flip the winner. The replay must keep the
    // second match and keep the bracket internally consistent.
    const corrected = correctEliminationResult(doc, first.id, {
      winnerId: first.teamBId!,
      loserId: first.teamAId!,
      scoreA: 10,
      scoreB: 21,
    });

    const replayed = findEliminationMatch(corrected.elimination!, first.id);
    expect(replayed?.winnerId).toBe(first.teamBId);
    expect(replayed?.scoreA).toBe(10);
    expect(replayed?.scoreB).toBe(21);
    expect(selectLossCount(corrected, first.teamAId!)).toBe(1);
  });

  it("keeps canonical standard-bracket links after recalculation", () => {
    const doc = makeEliminationDoc();
    const first = findEliminationMatch(doc.elimination!, "winners-r1-m1")!;
    const scored = scoreEliminationMatch(doc, {
      matchId: first.id,
      winnerId: first.teamAId!,
      loserId: first.teamBId!,
    });
    const corrected = correctEliminationResult(scored, first.id, {
      winnerId: first.teamAId!,
      loserId: first.teamBId!,
      scoreA: 22,
      scoreB: 20,
    });

    // Game 21 (Winners R3) feeds the Winners Final, never a crossover match.
    const game21 = findEliminationMatch(corrected.elimination!, GAME_IDS_16.game21);
    expect(game21?.winnerTo).toMatchObject({
      matchId: GAME_IDS_16.semiFinal1,
      slot: "teamA",
    });
    expect(listEliminationMatches(corrected.elimination!)).toHaveLength(30);
  });
});
