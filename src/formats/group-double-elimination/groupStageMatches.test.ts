import { describe, expect, it } from "vitest";
import type { Group, GroupStageMatch } from "./types";
import {
  applyGroupMatchScore,
  buildGroupMatchId,
  generateGroupStageSchedule,
  getGroupStageProgress,
  isGroupStageComplete,
  isGroupStageMatchComplete,
  resetGroupMatchScore,
} from "./groupStageMatches";
import { GroupStageError } from "./errors";

const makeGroup = (id: string, teamIds: string[]): Group => ({
  id,
  name: `Group ${id}`,
  teamIds,
});

const pairKey = (match: GroupStageMatch): string =>
  [match.teamAId, match.teamBId].sort().join("-");

const captureError = (action: () => unknown): GroupStageError => {
  try {
    action();
  } catch (error) {
    if (error instanceof GroupStageError) return error;
    throw error;
  }
  throw new Error("Expected a GroupStageError");
};

describe("round-robin generation", () => {
  it("generates every pair once for an even group", () => {
    const { matches, roundsPerGroup } = generateGroupStageSchedule([
      makeGroup("group-1", ["a", "b", "c", "d"]),
    ]);

    expect(matches).toHaveLength(6);
    expect(roundsPerGroup["group-1"]).toBe(3);
    expect(new Set(matches.map(pairKey)).size).toBe(6);
    expect(new Set(matches.flatMap((match) => [match.teamAId, match.teamBId])).size).toBe(4);
  });

  it("handles an odd group with one BYE per round", () => {
    const { matches, roundsPerGroup } = generateGroupStageSchedule([
      makeGroup("group-1", ["a", "b", "c"]),
    ]);

    expect(matches).toHaveLength(3);
    expect(roundsPerGroup["group-1"]).toBe(3);
    expect(new Set(matches.map(pairKey)).size).toBe(3);
  });

  it("gives every team n-1 games in an odd group", () => {
    const { matches } = generateGroupStageSchedule([
      makeGroup("group-1", ["a", "b", "c", "d", "e"]),
    ]);

    expect(matches).toHaveLength(10);
    for (const teamId of ["a", "b", "c", "d", "e"]) {
      const played = matches.filter(
        (match) => match.teamAId === teamId || match.teamBId === teamId
      );
      expect(played).toHaveLength(4);
    }
  });

  it("never schedules a team twice in the same round", () => {
    const { matches } = generateGroupStageSchedule([
      makeGroup("group-1", ["a", "b", "c", "d", "e"]),
    ]);

    const byRound = new Map<number, string[]>();
    for (const match of matches) {
      const teams = byRound.get(match.round) ?? [];
      teams.push(match.teamAId, match.teamBId);
      byRound.set(match.round, teams);
    }

    for (const teams of byRound.values()) {
      expect(new Set(teams).size).toBe(teams.length);
    }
  });

  it("creates deterministic, unique match ids", () => {
    const first = generateGroupStageSchedule([
      makeGroup("group-1", ["a", "b", "c", "d"]),
      makeGroup("group-2", ["e", "f", "g", "h"]),
    ]);
    const second = generateGroupStageSchedule([
      makeGroup("group-1", ["a", "b", "c", "d"]),
      makeGroup("group-2", ["e", "f", "g", "h"]),
    ]);

    expect(first).toEqual(second);
    expect(new Set(first.matches.map((match) => match.id)).size).toBe(12);
    expect(first.matches[0].id).toBe(buildGroupMatchId("group-1", 1, 1));
    expect(first.matches.every((match) => /^group-\d+-r\d+-m\d+$/.test(match.id))).toBe(true);
  });

  it("schedules each group independently", () => {
    const schedule = generateGroupStageSchedule([
      makeGroup("group-1", ["a", "b", "c", "d"]),
      makeGroup("group-2", ["e", "f", "g", "h"]),
    ]);

    expect(schedule.matches).toHaveLength(12);
    expect(schedule.roundsPerGroup).toEqual({
      "group-1": 3,
      "group-2": 3,
    });
    expect(schedule.rounds).toHaveLength(6);
    expect(
      schedule.rounds.filter((round) => round.groupId === "group-1")
    ).toHaveLength(3);
  });

  it("only references generated matches from rounds", () => {
    const schedule = generateGroupStageSchedule([
      makeGroup("group-1", ["a", "b", "c", "d", "e"]),
      makeGroup("group-2", ["f", "g", "h"]),
    ]);
    const matchIds = new Set(schedule.matches.map((match) => match.id));
    const roundMatchIds = schedule.rounds.flatMap((round) => round.matchIds);

    expect(roundMatchIds).toHaveLength(schedule.matches.length);
    expect(roundMatchIds.every((id) => matchIds.has(id))).toBe(true);
  });

  it("rejects groups that cannot play a match", () => {
    const error = captureError(() =>
      generateGroupStageSchedule([makeGroup("group-1", ["a"])])
    );

    expect(error.code).toBe("not-enough-teams");
  });

  it("rejects duplicate group ids", () => {
    const error = captureError(() =>
      generateGroupStageSchedule([
        makeGroup("group-1", ["a", "b"]),
        makeGroup("group-1", ["c", "d"]),
      ])
    );

    expect(error.code).toBe("duplicate-group");
  });

  it("rejects a team appearing in two groups", () => {
    const error = captureError(() =>
      generateGroupStageSchedule([
        makeGroup("group-1", ["a", "b"]),
        makeGroup("group-2", ["b", "c"]),
      ])
    );

    expect(error.code).toBe("duplicate-team");
  });
});

describe("group match scores", () => {
  const match = generateGroupStageSchedule([
    makeGroup("group-1", ["a", "b"]),
  ]).matches[0];

  it("completes a match and stores the winner", () => {
    const completed = applyGroupMatchScore(match, 21, 15);

    expect(completed.scoreA).toBe(21);
    expect(completed.scoreB).toBe(15);
    expect(completed.winnerId).toBe(match.teamAId);
    expect(completed.status).toBe("completed");
    expect(isGroupStageMatchComplete(completed)).toBe(true);
    expect(match.status).toBe("pending");
  });

  it("supports the away team winning", () => {
    const completed = applyGroupMatchScore(match, 10, 21);

    expect(completed.winnerId).toBe(match.teamBId);
  });

  it("allows a completed match to be corrected", () => {
    const first = applyGroupMatchScore(match, 21, 15);
    const corrected = applyGroupMatchScore(first, 15, 21);

    expect(corrected.winnerId).toBe(match.teamBId);
    expect(corrected.scoreA).toBe(15);
    expect(corrected.scoreB).toBe(21);
  });

  it("rejects tied scores", () => {
    expect(captureError(() => applyGroupMatchScore(match, 21, 21)).code).toBe(
      "invalid-score"
    );
  });

  it("rejects negative and fractional scores", () => {
    expect(captureError(() => applyGroupMatchScore(match, -1, 21)).code).toBe(
      "invalid-score"
    );
    expect(captureError(() => applyGroupMatchScore(match, 21.5, 15)).code).toBe(
      "invalid-score"
    );
  });

  it("rejects matches that are not group matches", () => {
    const invalid = { ...match, phase: "winners" } as unknown as GroupStageMatch;

    expect(captureError(() => applyGroupMatchScore(invalid, 21, 15)).code).toBe(
      "invalid-group-match"
    );
  });

  it("resets a score back to pending", () => {
    const completed = applyGroupMatchScore(match, 21, 15);
    const reset = resetGroupMatchScore(completed);

    expect(reset.scoreA).toBeNull();
    expect(reset.scoreB).toBeNull();
    expect(reset.winnerId).toBeNull();
    expect(reset.status).toBe("pending");
    expect(isGroupStageMatchComplete(reset)).toBe(false);
  });
});

describe("group completion detection", () => {
  const matches = generateGroupStageSchedule([
    makeGroup("group-1", ["a", "b", "c"]),
  ]).matches;

  it("treats an empty schedule as incomplete", () => {
    expect(isGroupStageComplete([])).toBe(false);
  });

  it("treats a partially played stage as incomplete", () => {
    const played = [applyGroupMatchScore(matches[0], 21, 15), ...matches.slice(1)];

    expect(isGroupStageComplete(played)).toBe(false);
  });

  it("detects a fully played stage", () => {
    const played = matches.map((match) =>
      applyGroupMatchScore(match, 21, 10)
    );

    expect(isGroupStageComplete(played)).toBe(true);
  });

  it("reports progress counts", () => {
    const played = [applyGroupMatchScore(matches[0], 21, 15), ...matches.slice(1)];
    const progress = getGroupStageProgress(played);

    expect(progress).toEqual({
      total: 3,
      completed: 1,
      remaining: 2,
      isComplete: false,
    });
  });

  it("reports an empty stage as zero progress without declaring completion", () => {
    expect(getGroupStageProgress([])).toEqual({
      total: 0,
      completed: 0,
      remaining: 0,
      isComplete: false,
    });
  });
});
