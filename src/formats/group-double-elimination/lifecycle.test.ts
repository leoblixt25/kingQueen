import { describe, expect, it } from "vitest";
import type { Team } from "./types";
import {
  createGsdeTournamentDocument,
  type GsdeTournamentDocument,
} from "./persistence";
import {
  buildTeamsAndGroups,
  correctEliminationResult,
  correctGroupMatchScore,
  generateEliminationBracket,
  reopenTournament,
  scoreEliminationMatch,
  scoreGroupMatch,
  ScoringError,
  startGroupStage,
} from "./scoring";
import { selectCorrections, type AuditActor } from "./audit";
import { listEliminationMatches } from "./bracket";
import { getGameNumber } from "./gameNumbers";
import {
  validateTournamentIntegrity,
  assertTournamentIntegrity,
} from "./integrity";

const ADMIN: AuditActor = { id: "admin-1", label: "admin@example.com", isAdmin: true };
const PLAYER: AuditActor = { id: "player-1", label: "player@example.com", isAdmin: false };

const makeTeams = (): Team[] =>
  Array.from({ length: 16 }, (_, index) => ({
    id: `t${index + 1}`,
    name: `Team ${index + 1}`,
    playerIds: [],
    seed: index + 1,
    groupId: null,
  }));

const ready = () =>
  buildTeamsAndGroups(createGsdeTournamentDocument("event-1"), makeTeams());

const playAllGroups = () => {
  let doc = ready();
  for (const match of [...doc.matches]) {
    doc = scoreGroupMatch(doc, match.id, 21, 10);
  }
  return doc;
};

const completeTournament = (): GsdeTournamentDocument => {
  let doc = generateEliminationBracket(playAllGroups());
  for (let step = 0; step < 40 && doc.tournament.status !== "completed"; step += 1) {
    const match = listEliminationMatches(doc.elimination!)
      .filter(
        (item) =>
          item.status !== "completed" &&
          item.teamAId !== null &&
          item.teamBId !== null
      )
      .sort(
        (a, b) =>
          (getGameNumber(a.id) ?? 999) - (getGameNumber(b.id) ?? 999)
      )[0];
    if (!match) break;
    doc = scoreEliminationMatch(doc, {
      matchId: match.id,
      winnerId: match.teamAId!,
      loserId: match.teamBId!,
    });
  }
  return doc;
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

describe("central integrity validation", () => {
  it("accepts a generated tournament and rejects duplicate ids", () => {
    const doc = generateEliminationBracket(playAllGroups());
    expect(validateTournamentIntegrity(doc)).toEqual([]);

    const broken = {
      ...doc,
      matches: doc.matches.map((match, index) =>
        index === 1 ? { ...match, id: doc.matches[0].id } : match
      ),
    };
    expect(() => assertTournamentIntegrity(broken)).toThrow();
    expect(validateTournamentIntegrity(broken).some((issue) => issue.code === "duplicate-group-match-id")).toBe(true);
  });

  it("rejects a completed elimination match with no loser", () => {
    const doc = generateEliminationBracket(playAllGroups());
    const broken = {
      ...doc,
      elimination: {
        ...doc.elimination!,
        winners: doc.elimination!.winners.map((match, index) =>
          index === 0
            ? { ...match, status: "completed" as const, winnerId: match.teamAId, loserId: null }
            : match
        ),
      },
    };
    expect(
      validateTournamentIntegrity(broken).some(
        (issue) => issue.code === "invalid-elimination-result"
      )
    ).toBe(true);
  });
});

describe("audit log", () => {
  it("records corrections with actor, match id and before/after detail", () => {
    let doc = startGroupStage(ready());
    const target = doc.matches[0];
    doc = scoreGroupMatch(doc, target.id, 21, 10, ADMIN);
    doc = correctGroupMatchScore(doc, target.id, 10, 21, ADMIN);

    const corrections = selectCorrections(doc);
    expect(corrections).toHaveLength(1);
    expect(corrections[0]).toMatchObject({
      actorId: ADMIN.id,
      actorLabel: ADMIN.label,
      action: "group-score-corrected",
      matchId: target.id,
    });
    expect(corrections[0].detail).toContain("21:10");
    expect(corrections[0].detail).toContain("10:21");
  });

  it("records elimination corrections and bracket overrides", () => {
    const partial = ready();
    const provisional = generateEliminationBracket(
      partial,
      { overrideIncomplete: true, adminConfirmed: true },
      ADMIN
    );
    expect(selectCorrections(provisional).some((entry) => entry.action === "bracket-override-generated")).toBe(true);

    let doc = generateEliminationBracket(playAllGroups());
    const first = listEliminationMatches(doc.elimination!)[0];
    doc = scoreEliminationMatch(doc, {
      matchId: first.id,
      winnerId: first.teamAId!,
      loserId: first.teamBId!,
    }, ADMIN);
    doc = correctEliminationResult(doc, first.id, {
      winnerId: first.teamBId!,
      loserId: first.teamAId!,
      scoreA: 10,
      scoreB: 21,
    }, ADMIN);

    expect(
      selectCorrections(doc).some(
        (entry) => entry.action === "elimination-result-corrected" && entry.matchId === first.id
      )
    ).toBe(true);
  });
});

describe("stage sequence and reopen", () => {
  it("refuses to edit group results after the stage has advanced", () => {
    const doc = generateEliminationBracket(playAllGroups());
    expect(
      capture(() => scoreGroupMatch(doc, doc.matches[0].id, 21, 5)).code
    ).toBe("stage-sequence");
    expect(capture(() => startGroupStage(doc)).code).toBe("stage-sequence");
  });

  it("refuses to change results after completion", () => {
    const doc = completeTournament();
    expect(doc.tournament.status).toBe("completed");
    const first = listEliminationMatches(doc.elimination!)[0];
    expect(
      capture(() =>
        correctEliminationResult(doc, first.id, {
          winnerId: first.teamAId!,
          loserId: first.teamBId!,
          scoreA: 21,
          scoreB: 10,
        })
      ).code
    ).toBe("stage-sequence");
  });

  it("requires an authorized admin and explicit discard confirmation to reopen", () => {
    const doc = completeTournament();
    expect(capture(() => reopenTournament(doc, PLAYER, { targetStage: "elimination", discardResults: true })).code).toBe("unauthorized");
    expect(capture(() => reopenTournament(doc, ADMIN, { targetStage: "elimination", discardResults: false })).code).toBe("confirm-discard");
    expect(capture(() => reopenTournament(ready(), ADMIN, { targetStage: "elimination", discardResults: true })).code).toBe("not-completed");
  });

  it("reopens for an authorized admin and records the action", () => {
    const doc = completeTournament();
    const reopened = reopenTournament(doc, ADMIN, {
      targetStage: "group-stage",
      discardResults: true,
    });

    expect(reopened.tournament.status).toBe("group-stage");
    expect(reopened.elimination).toBeNull();
    expect(reopened.tournament.groupStageVerified).toBe(false);
    expect(reopened.tournament.seedingStale).toBe(true);
    const last = reopened.auditLog![reopened.auditLog!.length - 1];
    expect(last).toMatchObject({
      action: "tournament-reopened",
      actorId: ADMIN.id,
    });
  });
});
