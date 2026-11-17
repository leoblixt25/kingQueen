import { describe, expect, it } from "vitest";
import type { Team } from "./types";
import { createGsdeTournamentDocument } from "./persistence";
import {
  approveTeam,
  buildTeamsAndGroups,
  completeGroupStage,
  editTeam,
  generateEliminationBracket,
  resetGroupMatch,
  scoreGroupMatch,
  scoreEliminationMatch,
  ScoringError,
  selectApprovedTeamCount,
  selectFinalResult,
  startGroupMatch,
  startGroupStage,
  verifyGroupStageCompletion,
} from "./scoring";
import { findEliminationMatch } from "./bracket";
import { createPendingTeam } from "./teams";

const makeTeams = (pending = false): Team[] =>
  Array.from({ length: 16 }, (_, index) => {
    const base: Team = {
      id: `t${index + 1}`,
      name: `Team ${index + 1}`,
      playerIds: [],
      seed: index + 1,
      groupId: null,
    };
    return pending ? createPendingTeam(base.id, { name: base.name, playerIds: [], seed: base.seed }) : base;
  });

const capture = (action: () => unknown): ScoringError => {
  try {
    action();
  } catch (error) {
    if (error instanceof ScoringError) return error;
    throw error;
  }
  throw new Error("Expected a ScoringError");
};

const readyDoc = (pending = false) =>
  buildTeamsAndGroups(createGsdeTournamentDocument("event-1"), makeTeams(pending));

const playAllGroups = (doc: ReturnType<typeof readyDoc>) =>
  doc.matches.reduce(
    (current, match) => scoreGroupMatch(current, match.id, 21, 10),
    doc
  );

describe("team registration workflow", () => {
  it("creates pending teams and only counts approved ones", () => {
    const pending = makeTeams(true);
    expect(pending.every((team) => team.status === "pending")).toBe(true);

    const base = createGsdeTournamentDocument("event-1");
    const withTeams = { ...base, teams: pending };
    expect(selectApprovedTeamCount(withTeams)).toBe(0);

    const approved = approveTeam(withTeams, pending[0].id, true);
    expect(selectApprovedTeamCount(approved)).toBe(1);
    expect(approved.teams[0].status).toBe("approved");
  });

  it("gates group generation on approval", () => {
    const base = createGsdeTournamentDocument("event-1");
    const withTeams = { ...base, teams: makeTeams(true) };
    expect(capture(() => buildTeamsAndGroups(withTeams, withTeams.teams)).code).toBe(
      "invalid-team"
    );

    const allApproved = withTeams.teams.reduce(
      (doc, team) => approveTeam(doc, team.id, true),
      withTeams
    );
    expect(() => buildTeamsAndGroups(allApproved, allApproved.teams)).not.toThrow();
  });

  it("edits team name and seed with validation", () => {
    const base = createGsdeTournamentDocument("event-1");
    const withTeams = { ...base, teams: makeTeams() };
    const edited = editTeam(withTeams, "t1", { name: "Renamed", seed: 20 });
    expect(edited.teams[0]).toMatchObject({ name: "Renamed", seed: 20 });

    // Duplicate name against another team is rejected.
    expect(capture(() => editTeam(withTeams, "t1", { name: "Team 2" })).code).toBe(
      "invalid-team"
    );
  });
});

describe("group-stage management", () => {
  it("starts and resets a group match", () => {
    const doc = startGroupStage(readyDoc());
    const matchId = doc.matches[0].id;

    const started = startGroupMatch(doc, matchId);
    expect(started.matches[0].status).toBe("ready");

    const scored = scoreGroupMatch(started, matchId, 21, 12);
    expect(scored.matches[0].status).toBe("completed");

    const reset = resetGroupMatch(scored, matchId);
    expect(reset.matches[0]).toMatchObject({
      scoreA: null,
      scoreB: null,
      winnerId: null,
      status: "pending",
    });
  });

  it("verifies completion and gates the explicit completion step", () => {
    const doc = startGroupStage(readyDoc());
    expect(verifyGroupStageCompletion(doc)).toMatchObject({
      isComplete: false,
      total: 24,
    });
    expect(capture(() => completeGroupStage(doc)).code).toBe("group-stage-incomplete");

    const complete = completeGroupStage(playAllGroups(doc));
    expect(complete.tournament.groupStageVerified).toBe(true);
    expect(verifyGroupStageCompletion(complete).isComplete).toBe(true);
    expect(verifyGroupStageCompletion(complete).ranking).toHaveLength(16);
  });
});

describe("bracket override and completion", () => {
  it("refuses an incomplete bracket without explicit confirmation", () => {
    const doc = readyDoc();
    expect(capture(() => generateEliminationBracket(doc)).code).toBe(
      "group-stage-incomplete"
    );
    expect(
      capture(() =>
        generateEliminationBracket(doc, { overrideIncomplete: true })
      ).code
    ).toBe("group-stage-incomplete");
    expect(
      capture(() =>
        generateEliminationBracket(doc, { adminConfirmed: true })
      ).code
    ).toBe("group-stage-incomplete");
  });

  it("allows a confirmed override and flags the bracket as provisional", () => {
    const doc = readyDoc();
    const provisional = generateEliminationBracket(doc, {
      overrideIncomplete: true,
      adminConfirmed: true,
    });

    expect(provisional.elimination).not.toBeNull();
    expect(provisional.elimination?.seededTeamIds).toHaveLength(16);
    expect(provisional.tournament.seedingStale).toBe(true);
    expect(provisional.tournament.bracketOverrideUsed).toBe(true);
    expect(provisional.tournament.groupStageVerified).toBe(false);
  });

  it("reports champion, runner-up and placements at completion", () => {
    let doc = generateEliminationBracket(playAllGroups(readyDoc()));
    const first = findEliminationMatch(doc.elimination!, "winners-r1-m1")!;
    doc = scoreEliminationMatch(doc, {
      matchId: first.id,
      winnerId: first.teamAId!,
      loserId: first.teamBId!,
    });

    const result = selectFinalResult(doc);
    expect(result.complete).toBe(false);
    expect(result.placements).toBeDefined();
  });
});
