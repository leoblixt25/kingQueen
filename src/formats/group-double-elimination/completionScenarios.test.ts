import { describe, expect, it } from "vitest";
import type { AuditActor } from "./audit";
import { GRAND_FINAL_ONE_ID, findEliminationMatch, listEliminationMatches, validateEliminationBracket } from "./bracket";
import { validateTournamentCompletion } from "./completion";
import { calculateEliminationStandings, validateFinalPlacements } from "./eliminationStandings";
import {
  calculateGroupStandings,
  resolveGroupTiebreakers,
} from "./groupStandings";
import { applyGroupMatchScore, generateGroupStageSchedule } from "./groupStageMatches";
import {
  buildTeamsAndGroups,
  correctEliminationResult,
  generateEliminationBracket,
  scoreEliminationMatch,
  scoreGroupMatch,
  selectCompletion,
  selectFinalResult,
  selectGroupStandings,
  selectLossCount,
  selectProgress,
  ScoringError,
} from "./scoring";
import { needsGrandFinalReset } from "./progression";
import { createGsdeTournamentDocument, type GsdeTournamentDocument } from "./persistence";
import { buildGsdeTournamentReport } from "./report";
import type { Group, GroupStageMatch, Team, TeamId } from "./types";
import { buildGsdePdf } from "../../utils/gsdePdfExport";

const ADMIN: AuditActor = { id: "admin-1", label: "admin@test", isAdmin: true };

const makeTeams = (count: number): Team[] =>
  Array.from({ length: count }, (_, index) => ({
    id: `t${index + 1}`,
    name: `Team ${index + 1}`,
    playerIds: [],
    seed: index + 1,
    groupId: null,
  }));

const readyDoc = (count = 16): GsdeTournamentDocument => {
  const base = createGsdeTournamentDocument(`audit-${count}`);
  base.tournament.config.teamLimit = count;
  return buildTeamsAndGroups(base, makeTeams(count), ADMIN);
};

/** Better seed wins every group match. */
const playGroups = (doc: GsdeTournamentDocument): GsdeTournamentDocument => {
  const seeds = new Map(doc.teams.map((team) => [team.id, team.seed ?? 99]));
  let current = doc;
  for (const match of [...doc.matches]) {
    const teamAWins =
      (seeds.get(match.teamAId) ?? 99) < (seeds.get(match.teamBId) ?? 99);
    current = scoreGroupMatch(
      current,
      match.id,
      teamAWins ? 21 : 10,
      teamAWins ? 10 : 21,
      ADMIN
    );
  }
  return current;
};

const bracketDoc = (count = 16): GsdeTournamentDocument =>
  generateEliminationBracket(playGroups(readyDoc(count)), {}, ADMIN);

type Decide = (matchId: string, teamA: TeamId, teamB: TeamId) => TeamId;

/** Play every ready elimination match until completion validation passes. */
const playAll = (
  doc: GsdeTournamentDocument,
  decide: Decide = (_id, teamA) => teamA,
  maxSteps = 100
): GsdeTournamentDocument => {
  let current = doc;
  for (let step = 0; step < maxSteps; step += 1) {
    if (selectCompletion(current).isComplete) break;
    const next = listEliminationMatches(current.elimination!)
      .filter(
        (match) =>
          match.status === "ready" &&
          match.teamAId !== null &&
          match.teamBId !== null
      )
      .sort(
        (a, b) => a.round - b.round || a.index - b.index || a.id.localeCompare(b.id)
      )[0];
    if (!next) break;
    const winnerId = decide(next.id, next.teamAId!, next.teamBId!);
    const loserId =
      winnerId === next.teamAId ? next.teamBId! : next.teamAId!;
    current = scoreEliminationMatch(
      current,
      { matchId: next.id, winnerId, loserId },
      ADMIN
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

describe("A - normal 16-team double elimination", () => {
  it("plays 30 canonical matches and validates as completed", () => {
    const withBracket = bracketDoc(16);
    expect(withBracket.elimination!.winners).toHaveLength(15);
    expect(withBracket.elimination!.losers).toHaveLength(14);
    expect(withBracket.elimination!.grandFinal).toHaveLength(1);
    expect(validateEliminationBracket(withBracket.elimination!)).toEqual([]);

    const done = playAll(withBracket);
    const completion = selectCompletion(done);

    expect(completion.isComplete).toBe(true);
    expect(completion.issues).toEqual([]);
    expect(completion.groups.total).toBe(24);
    expect(completion.elimination.total).toBe(30);
    expect(completion.elimination.completed).toBe(30);
    expect(completion.elimination.reviewRequired).toBe(0);
    expect(done.tournament.status).toBe("completed");

    const result = selectFinalResult(done);
    expect(result.complete).toBe(true);
    expect(result.validated).toBe(true);
    expect(result.championTeamIds).toHaveLength(1);
    expect(result.runnerUpTeamIds).toHaveLength(1);
    expect(result.placements.flatMap((row) => row.teamIds)).toHaveLength(16);
  });
});

describe("B - reset final", () => {
  it("requires and decides a reset when the Winners champion loses GF1", () => {
    const done = playAll(bracketDoc(16), (matchId, teamA, teamB) =>
      matchId === GRAND_FINAL_ONE_ID ? teamB : teamA
    );

    expect(done.elimination!.grandFinal).toHaveLength(2);
    expect(listEliminationMatches(done.elimination!)).toHaveLength(31);
    expect(done.elimination!.resetFinalRequired).toBe(true);
    expect(needsGrandFinalReset(done.elimination!)).toBe(false);

    const completion = selectCompletion(done);
    expect(completion.isComplete).toBe(true);
    expect(completion.resetRequired).toBe(false);
    expect(completion.resetWasPlayed).toBe(true);

    const report = buildGsdeTournamentReport(done, {
      generatedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(report.resetWasPlayed).toBe(true);
    expect(report.resetFinalRequired).toBe(false);
    expect(report.validated).toBe(true);
  });
});

describe("C - corrections and replay", () => {
  const partiallyPlayed = (): GsdeTournamentDocument => {
    let doc = bracketDoc(16);
    const first = findEliminationMatch(doc.elimination!, "winners-r1-m1")!;
    doc = scoreEliminationMatch(
      doc,
      { matchId: first.id, winnerId: first.teamAId!, loserId: first.teamBId! },
      ADMIN
    );
    const second = findEliminationMatch(doc.elimination!, "winners-r1-m2")!;
    doc = scoreEliminationMatch(
      doc,
      { matchId: second.id, winnerId: second.teamAId!, loserId: second.teamBId! },
      ADMIN
    );
    const roundTwo = findEliminationMatch(doc.elimination!, "winners-r2-m1")!;
    return scoreEliminationMatch(
      doc,
      {
        matchId: roundTwo.id,
        winnerId: roundTwo.teamAId!,
        loserId: roundTwo.teamBId!,
      },
      ADMIN
    );
  };

  it("replays canonically and flags discarded downstream results", () => {
    const doc = partiallyPlayed();
    const first = findEliminationMatch(doc.elimination!, "winners-r1-m1")!;

    const corrected = correctEliminationResult(
      doc,
      first.id,
      {
        winnerId: first.teamBId!,
        loserId: first.teamAId!,
        scoreA: 10,
        scoreB: 21,
      },
      ADMIN
    );

    expect(corrected.elimination!.invalidatedResultIds).toContain(
      "winners-r2-m1"
    );
    const flagged = findEliminationMatch(corrected.elimination!, "winners-r2-m1")!;
    expect(flagged.reviewRequired).toBe(true);
    expect(flagged.reviewReason).toMatch(/correction/i);

    // Canonical routing survives the replay: game 21 feeds the Winners Final.
    const game21 = findEliminationMatch(corrected.elimination!, "winners-r3-m1")!;
    expect(game21.winnerTo).toMatchObject({
      matchId: "winners-r4-m1",
      slot: "teamA",
    });
    expect(validateEliminationBracket(corrected.elimination!)).toEqual([]);

    const completion = selectCompletion(corrected);
    expect(completion.isComplete).toBe(false);
    expect(completion.issues.join(" ")).toMatch(/review/i);
  });

  it("rejects a correction for an unknown match id", () => {
    const doc = bracketDoc(16);
    const error = capture(() =>
      correctEliminationResult(
        doc,
        "not-a-real-match",
        { winnerId: "t1", loserId: "t2", scoreA: 21, scoreB: 10 },
        ADMIN
      )
    );
    expect(error.code).toBe("unknown-match");
  });

  it("replays correctly for 8, 24 and 32 team brackets", () => {
    for (const count of [8, 24, 32]) {
      let doc = bracketDoc(count);
      const totalBefore = listEliminationMatches(doc.elimination!).length;
      const ready = () =>
        listEliminationMatches(doc.elimination!).filter(
          (match) =>
            match.status === "ready" &&
            match.teamAId !== null &&
            match.teamBId !== null
        );

      // 24-team brackets collapse one bye match, so always pick real matches.
      const first = ready()[0];
      doc = scoreEliminationMatch(
        doc,
        { matchId: first.id, winnerId: first.teamAId!, loserId: first.teamBId! },
        ADMIN
      );
      const second = ready()[0];
      if (second) {
        doc = scoreEliminationMatch(
          doc,
          {
            matchId: second.id,
            winnerId: second.teamAId!,
            loserId: second.teamBId!,
          },
          ADMIN
        );
      }

      const corrected = correctEliminationResult(
        doc,
        first.id,
        {
          winnerId: first.teamBId!,
          loserId: first.teamAId!,
          scoreA: 10,
          scoreB: 21,
        },
        ADMIN
      );

      expect(listEliminationMatches(corrected.elimination!)).toHaveLength(
        totalBefore
      );
      expect(validateEliminationBracket(corrected.elimination!)).toEqual([]);
    }
  });
});

describe("D - incomplete tournaments", () => {
  it("blocks completion and keeps status out of completed", () => {
    const empty = readyDoc(16);
    expect(selectCompletion(empty).isComplete).toBe(false);
    expect(selectProgress(empty).isComplete).toBe(false);
    expect(empty.tournament.status).not.toBe("completed");

    const withBracket = bracketDoc(16);
    const first = findEliminationMatch(withBracket.elimination!, "winners-r1-m1")!;
    const partial = scoreEliminationMatch(
      withBracket,
      { matchId: first.id, winnerId: first.teamAId!, loserId: first.teamBId! },
      ADMIN
    );

    const completion = selectCompletion(partial);
    expect(completion.isComplete).toBe(false);
    expect(completion.issues.some((issue) => /unresolved/i.test(issue))).toBe(true);
    expect(completion.issues.some((issue) => /champion/i.test(issue))).toBe(true);
    expect(partial.tournament.status).not.toBe("completed");
    expect(selectProgress(partial).issues).toEqual(completion.issues);

    // The same validator drives the report consumed by the PDF.
    const report = buildGsdeTournamentReport(partial, {
      generatedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(report.validated).toBe(false);
    expect(report.complete).toBe(false);
    expect(report.completionIssues).toEqual(completion.issues);
    expect(report.counts.eliminationMatchesCompleted).toBe(
      completion.elimination.completed
    );
    expect(report.counts.eliminationMatchesTotal).toBe(
      completion.elimination.total
    );
  });

  it("marks provisional brackets from incomplete group standings", () => {
    const doc = generateEliminationBracket(readyDoc(16), {
      overrideIncomplete: true,
      adminConfirmed: true,
    }, ADMIN);

    expect(doc.tournament.seedingStale).toBe(true);
    const report = buildGsdeTournamentReport(doc, {
      generatedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(report.provisional).toBe(true);
    expect(report.validated).toBe(false);
    expect(
      capture(() =>
        scoreEliminationMatch(
          doc,
          { matchId: "winners-r1-m1", winnerId: "t1", loserId: "t16" },
          ADMIN
        )
      ).code
    ).toBe("seeding-stale");
  });
});

describe("E - group ranking ties", () => {
  it("honours the configured tiebreaker order with wins mandatory", () => {
    const group: Group = { id: "group-1", name: "Group A", teamIds: ["a", "b", "c", "d"] };
    let matches: GroupStageMatch[] = generateGroupStageSchedule([group]).matches;
    const complete = (teamAId: string, teamBId: string, scoreA: number, scoreB: number) => {
      matches = matches.map((match) => {
        if (match.teamAId === teamAId && match.teamBId === teamBId) {
          return applyGroupMatchScore(match, scoreA, scoreB);
        }
        if (match.teamAId === teamBId && match.teamBId === teamAId) {
          return applyGroupMatchScore(match, scoreB, scoreA);
        }
        return match;
      });
    };

    // a and b both finish 2-1. a owns the head-to-head; b has the better
    // overall point difference, so the two tiebreakers disagree.
    complete("a", "c", 21, 20);
    complete("a", "b", 21, 19);
    complete("b", "c", 21, 2);
    complete("b", "d", 21, 2);
    complete("d", "a", 21, 17);

    const defaultOrder = calculateGroupStandings(group, matches);
    const pointsFirst = calculateGroupStandings(group, matches, [
      "wins",
      "point-difference",
      "head-to-head",
    ]);
    const unknownKeys = ["point-difference", "point-difference", "bogus", "wins"];

    expect(defaultOrder.rows[0].teamId).toBe("a");
    expect(pointsFirst.rows[0].teamId).toBe("b");
    expect(resolveGroupTiebreakers(unknownKeys)[0]).toBe("wins");
    expect(resolveGroupTiebreakers(unknownKeys)).toEqual([
      "wins",
      "point-difference",
      "head-to-head",
      "mini-league-difference",
      "points-scored",
      "team-id",
    ]);
    expect(
      calculateGroupStandings(group, matches, unknownKeys).rows.map((row) => row.teamId)
    ).toEqual(pointsFirst.rows.map((row) => row.teamId));

    // The document selector uses the same stored configuration.
    const doc = readyDoc(16);
    doc.settings.groupTiebreakers = ["wins", "point-difference", "head-to-head"];
    expect(selectGroupStandings(doc).length).toBeGreaterThan(0);
  });
});

describe("F - team elimination", () => {
  it("never eliminates a team before its second loss", () => {
    const done = playAll(bracketDoc(16));
    for (const team of done.teams) {
      expect(selectLossCount(done, team.id)).toBeLessThanOrEqual(2);
    }

    const standings = calculateEliminationStandings(done.elimination!);
    expect(standings.filter((row) => row.status === "champion")).toHaveLength(1);
    const eliminated = standings.filter((row) => row.status === "eliminated");
    expect(eliminated).toHaveLength(15);
    expect(eliminated.every((row) => row.losses === 2)).toBe(true);
  });
});

describe("G - placement validation", () => {
  it("accepts a completed bracket and reports blockers on a partial one", () => {
    const done = playAll(bracketDoc(16));
    const completeCheck = validateFinalPlacements(done.elimination!, true);
    expect(completeCheck.isConsistent).toBe(true);
    expect(completeCheck.issues).toEqual([]);
    expect(selectCompletion(done).issues).toEqual([]);

    const withBracket = bracketDoc(16);
    const first = findEliminationMatch(withBracket.elimination!, "winners-r1-m1")!;
    const partial = scoreEliminationMatch(
      withBracket,
      { matchId: first.id, winnerId: first.teamAId!, loserId: first.teamBId! },
      ADMIN
    );
    const partialCheck = validateFinalPlacements(partial.elimination!, true);
    expect(partialCheck.isConsistent).toBe(false);
    expect(partialCheck.issues.join(" ")).toMatch(/champion|runner-up|unplaced/i);
    expect(selectCompletion(partial).issues).toEqual(
      expect.arrayContaining(partialCheck.issues)
    );
  });
});

describe("PDF / live agreement", () => {
  it("uses the same validated source for the report, PDF and selectors", () => {
    const done = playAll(bracketDoc(16));
    const completion = validateTournamentCompletion(done);
    const report = buildGsdeTournamentReport(done, {
      generatedAt: "2026-01-01T00:00:00.000Z",
    });

    expect(report.validated).toBe(completion.isComplete);
    expect(report.complete).toBe(selectFinalResult(done).complete);
    expect(report.completionIssues).toEqual(completion.issues);
    expect(report.counts.groupMatchesTotal).toBe(completion.groups.total);
    expect(report.counts.groupMatchesCompleted).toBe(completion.groups.completed);
    expect(report.counts.eliminationMatchesTotal).toBe(
      completion.elimination.total
    );
    expect(report.counts.eliminationMatchesCompleted).toBe(
      completion.elimination.completed
    );

    const pdf = buildGsdePdf(report);
    expect(pdf.getNumberOfPages()).toBeGreaterThan(0);
  });
});
