import { describe, expect, it } from "vitest";
import type { AuditActor } from "./audit";
import { listEliminationMatches } from "./bracket";
import { createGsdeTournamentDocument } from "./persistence";
import {
  buildTeamsAndGroups,
  completeGroupStage,
  correctGroupMatchScore,
  generateEliminationBracket,
  scoreGroupMatch,
  selectEliminationStandings,
  selectGroupStandings,
  startGroupStage,
} from "./scoring";
import type { PlayerRegistration, Team } from "./types";
import {
  PlayerSubmissionError,
  findPlayerSubmission,
  findSubmissionForMatch,
  listPlayerSubmittableMatches,
  submitPlayerEliminationScore,
  submitPlayerGroupScore,
} from "./playerSubmission";

const ADMIN: AuditActor = {
  id: "admin-1",
  label: "admin@kingqueen.test",
  isAdmin: true,
};

const makeTeams = (): Team[] =>
  Array.from({ length: 16 }, (_, index) => ({
    id: `t${index + 1}`,
    name: `Team ${index + 1}`,
    playerIds: [`uid-${index + 1}`],
    seed: index + 1,
    groupId: null,
    status: "approved" as const,
  }));

const makeRegistrations = (): PlayerRegistration[] =>
  Array.from({ length: 16 }, (_, index) => ({
    uid: `uid-${index + 1}`,
    email: `player${index + 1}@test.test`,
    name: `Player ${index + 1}`,
    status: "approved" as const,
    teamId: `t${index + 1}`,
    registeredAt: "2026-01-01T00:00:00.000Z",
    decidedAt: "2026-01-01T00:00:00.000Z",
  }));

const readyDoc = () => {
  const teams = makeTeams();
  return startGroupStage(
    buildTeamsAndGroups(
      createGsdeTournamentDocument("test1", {
        teams,
        registrations: makeRegistrations(),
      }),
      teams,
      ADMIN
    ),
    ADMIN
  );
};

const firstMatchFor = (doc: ReturnType<typeof readyDoc>, teamId: string) => {
  const match = doc.matches.find(
    (item) => item.teamAId === teamId || item.teamBId === teamId
  );
  if (!match) throw new Error(`No match for ${teamId}`);
  return match;
};

const expectError = (action: () => unknown, code: string) => {
  try {
    action();
    throw new Error("Expected an error");
  } catch (error) {
    expect(error).toBeInstanceOf(PlayerSubmissionError);
    expect((error as PlayerSubmissionError).code).toBe(code);
  }
};

describe("GSDE player score submission", () => {
  it("lets an approved player submit one of their own group matches", () => {
    const doc = readyDoc();
    const match = firstMatchFor(doc, "t1");
    const isA = match.teamAId === "t1";

    const next = submitPlayerGroupScore(doc, {
      uid: "uid-1",
      matchId: match.id,
      scoreFor: 7,
      scoreAgainst: 3,
    });

    const scored = next.matches.find((item) => item.id === match.id)!;
    expect(scored.status).toBe("completed");
    expect(scored.scoreA).toBe(isA ? 7 : 3);
    expect(scored.scoreB).toBe(isA ? 3 : 7);
    expect(scored.winnerId).toBe("t1");

    const submission = findPlayerSubmission(next, "uid-1", match.id);
    expect(submission?.stage).toBe("group");
    expect(submission?.playerLabel).toBe("player1@test.test");
    expect(submission?.winnerId).toBe("t1");
    expect(findSubmissionForMatch(next, match.id)?.playerUid).toBe("uid-1");
  });

  it("locks a submitted score so the player cannot edit or resubmit", () => {
    const doc = readyDoc();
    const match = firstMatchFor(doc, "t1");
    const submitted = submitPlayerGroupScore(doc, {
      uid: "uid-1",
      matchId: match.id,
      scoreFor: 7,
      scoreAgainst: 3,
    });

    expectError(
      () =>
        submitPlayerGroupScore(submitted, {
          uid: "uid-1",
          matchId: match.id,
          scoreFor: 9,
          scoreAgainst: 1,
        }),
      "already-submitted"
    );
    // A different player cannot submit the match either (not their team).
    expectError(
      () =>
        submitPlayerGroupScore(submitted, {
          uid: "uid-2",
          matchId: match.id,
          scoreFor: 9,
          scoreAgainst: 1,
        }),
      "not-your-match"
    );
  });

  it("rejects players who are not approved or not in the match", () => {
    const doc = readyDoc();
    const match = firstMatchFor(doc, "t1");
    const other = doc.matches.find(
      (item) => item.teamAId !== "t1" && item.teamBId !== "t1"
    )!;

    expectError(
      () =>
        submitPlayerGroupScore(doc, {
          uid: "not-registered",
          matchId: match.id,
          scoreFor: 7,
          scoreAgainst: 3,
        }),
      "not-registered"
    );
    expectError(
      () =>
        submitPlayerGroupScore(doc, {
          uid: "uid-1",
          matchId: other.id,
          scoreFor: 7,
          scoreAgainst: 3,
        }),
      "not-your-match"
    );
  });

  it("rejects tied and negative scores", () => {
    const doc = readyDoc();
    const match = firstMatchFor(doc, "t1");
    expectError(
      () =>
        submitPlayerGroupScore(doc, {
          uid: "uid-1",
          matchId: match.id,
          scoreFor: 4,
          scoreAgainst: 4,
        }),
      "invalid-score"
    );
    expectError(
      () =>
        submitPlayerGroupScore(doc, {
          uid: "uid-1",
          matchId: match.id,
          scoreFor: -1,
          scoreAgainst: 3,
        }),
      "invalid-score"
    );
  });

  it("keeps admin correction rights and the audit trail intact", () => {
    const doc = readyDoc();
    const match = firstMatchFor(doc, "t1");
    const isA = match.teamAId === "t1";
    const submitted = submitPlayerGroupScore(doc, {
      uid: "uid-1",
      matchId: match.id,
      scoreFor: 7,
      scoreAgainst: 3,
    });
    const corrected = correctGroupMatchScore(
      submitted,
      match.id,
      isA ? 1 : 9,
      isA ? 9 : 1,
      ADMIN
    );
    const scored = corrected.matches.find((item) => item.id === match.id)!;

    expect(scored.scoreA).toBe(isA ? 1 : 9);
    expect(scored.scoreB).toBe(isA ? 9 : 1);
    expect(corrected.auditLog?.some((entry) => entry.action === "group-score-corrected")).toBe(
      true
    );
    // The original submission remains as immutable proof of who submitted it.
    expect(findPlayerSubmission(corrected, "uid-1", match.id)?.playerUid).toBe("uid-1");
  });

  it("lists only the player's own unsubmitted matches", () => {
    const doc = readyDoc();
    const all = listPlayerSubmittableMatches(doc, "t1");
    expect(all.length).toBe(3); // every team plays three group matches
    expect(all.every((item) => item.stage === "group")).toBe(true);

    const submitted = submitPlayerGroupScore(doc, {
      uid: "uid-1",
      matchId: all[0].matchId,
      scoreFor: 7,
      scoreAgainst: 3,
    });
    const remaining = listPlayerSubmittableMatches(submitted, "t1");
    expect(remaining).toHaveLength(2);
    expect(remaining.some((item) => item.matchId === all[0].matchId)).toBe(false);
  });

  it("lets a player submit an elimination match without mixing the two ranking systems", () => {
    let doc = readyDoc();
    for (const match of doc.matches) {
      doc = scoreGroupMatch(doc, match.id, 7, 3, ADMIN);
    }
    const bracketReady = generateEliminationBracket(
      completeGroupStage(doc, ADMIN),
      {},
      ADMIN
    );
    const eliminationMatch = listEliminationMatches(bracketReady.elimination!).find(
      (match) => match.teamAId === "t1" && match.teamBId !== null
    )!;
    expect(eliminationMatch).toBeDefined();

    const submitted = submitPlayerEliminationScore(bracketReady, {
      uid: "uid-1",
      matchId: eliminationMatch.id,
      scoreFor: 9,
      scoreAgainst: 4,
    });
    const scored = listEliminationMatches(submitted.elimination!).find(
      (match) => match.id === eliminationMatch.id
    )!;
    expect(scored.status).toBe("completed");
    expect(scored.winnerId).toBe("t1");
    expect(scored.loserId).toBe(eliminationMatch.teamBId);
    expect(findPlayerSubmission(submitted, "uid-1", eliminationMatch.id)?.stage).toBe(
      "elimination"
    );

    const groupRow = selectGroupStandings(submitted)
      .flatMap((table) => table.rows)
      .find((row) => row.teamId === "t1");
    const eliminationRow = selectEliminationStandings(submitted).find(
      (row) => row.teamId === "t1"
    );
    // All three group wins were recorded in the group stage; the elimination
    // win is counted only in the elimination system, never added to group W-L.
    expect(groupRow?.wins).toBe(3);
    expect(eliminationRow?.wins).toBe(1);
    expect(eliminationRow?.losses).toBe(0);
  });
});
