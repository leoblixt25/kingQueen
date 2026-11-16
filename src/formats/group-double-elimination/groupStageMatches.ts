import type {
  Group,
  GroupId,
  GroupStageMatch,
  MatchId,
  TeamId,
} from "./types";
import { GroupStageError } from "./errors";

/**
 * Group-stage match generation and score handling.
 *
 * Pure functions only: no React, no Firebase, no mutation of the inputs.
 */

export interface GroupStageRound {
  groupId: GroupId;
  round: number;
  matchIds: MatchId[];
}

export interface GroupStageSchedule {
  matches: GroupStageMatch[];
  rounds: GroupStageRound[];
  roundsPerGroup: Record<GroupId, number>;
}

/** Deterministic and unique within a group stage: `group-1-r1-m1`. */
export const buildGroupMatchId = (
  groupId: GroupId,
  round: number,
  index: number
): MatchId => `${groupId}-r${round}-m${index}`;

const assertValidGroups = (groups: readonly Group[]): void => {
  const groupIds = new Set<GroupId>();
  const teamIds = new Set<TeamId>();

  for (const group of groups) {
    if (!group.id || groupIds.has(group.id)) {
      throw new GroupStageError(
        "duplicate-group",
        `Group id "${group.id}" is empty or duplicated.`
      );
    }
    groupIds.add(group.id);

    if (group.teamIds.length < 2) {
      throw new GroupStageError(
        "not-enough-teams",
        `${group.name} needs at least 2 teams to generate matches.`
      );
    }

    for (const teamId of group.teamIds) {
      if (teamIds.has(teamId)) {
        throw new GroupStageError(
          "duplicate-team",
          `Team "${teamId}" appears in more than one group.`
        );
      }
      teamIds.add(teamId);
    }
  }
};

/**
 * Generates a single round robin per group with the circle method.
 *
 * - Even group: `n - 1` rounds, every team plays once per round.
 * - Odd group: one BYE per round, `n` rounds, every team plays `n - 1` games.
 * - Every pair meets exactly once; no match is generated for a BYE.
 */
export const generateGroupStageSchedule = (
  groups: readonly Group[]
): GroupStageSchedule => {
  assertValidGroups(groups);

  const matches: GroupStageMatch[] = [];
  const rounds: GroupStageRound[] = [];
  const roundsPerGroup: Record<GroupId, number> = {};

  for (const group of groups) {
    const slots: Array<TeamId | null> = [...group.teamIds];
    if (slots.length % 2 === 1) slots.push(null);

    const slotCount = slots.length;
    const roundCount = slotCount - 1;
    let rotation = slots.slice(1);

    roundsPerGroup[group.id] = roundCount;

    for (let round = 1; round <= roundCount; round += 1) {
      const roundMatches: GroupStageMatch[] = [];

      for (let position = 0; position < slotCount / 2; position += 1) {
        const teamAId =
          position === 0 ? slots[0] : rotation[position - 1];
        const teamBId = rotation[slotCount - 2 - position];

        // One side is a BYE in odd groups — no match is created for it.
        if (!teamAId || !teamBId) continue;

        const index = roundMatches.length + 1;
        roundMatches.push({
          id: buildGroupMatchId(group.id, round, index),
          phase: "group",
          groupId: group.id,
          round,
          index,
          teamAId,
          teamBId,
          scoreA: null,
          scoreB: null,
          status: "pending",
          winnerId: null,
        });
      }

      matches.push(...roundMatches);
      rounds.push({
        groupId: group.id,
        round,
        matchIds: roundMatches.map((match) => match.id),
      });

      // Rotate all slots except the fixed first one.
      rotation = [
        rotation[rotation.length - 1],
        ...rotation.slice(0, -1),
      ];
    }
  }

  return { matches, rounds, roundsPerGroup };
};

const isValidScore = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 0;

/**
 * Applies a single-set score to a group match.
 *
 * Works for both the first submission and a later admin correction; the
 * winner and completion status are always recomputed from the scores.
 */
export const applyGroupMatchScore = (
  match: GroupStageMatch,
  scoreA: number,
  scoreB: number
): GroupStageMatch => {
  if (match.phase !== "group" || !match.teamAId || !match.teamBId) {
    throw new GroupStageError(
      "invalid-group-match",
      "Only group matches with two teams can receive a score."
    );
  }
  if (match.teamAId === match.teamBId) {
    throw new GroupStageError(
      "invalid-group-match",
      "A team cannot play itself."
    );
  }
  if (!isValidScore(scoreA) || !isValidScore(scoreB)) {
    throw new GroupStageError(
      "invalid-score",
      "Scores must be non-negative integers."
    );
  }
  if (scoreA === scoreB) {
    throw new GroupStageError(
      "invalid-score",
      "Single-set matches cannot end in a tie."
    );
  }

  return {
    ...match,
    scoreA,
    scoreB,
    winnerId: scoreA > scoreB ? match.teamAId : match.teamBId,
    status: "completed",
  };
};

/** Clears a result so the match can be replayed or corrected. */
export const resetGroupMatchScore = (
  match: GroupStageMatch
): GroupStageMatch => ({
  ...match,
  scoreA: null,
  scoreB: null,
  winnerId: null,
  status: "pending",
});

export const isGroupStageMatchComplete = (
  match: GroupStageMatch
): boolean =>
  match.phase === "group" &&
  match.status === "completed" &&
  match.scoreA !== null &&
  match.scoreB !== null &&
  match.scoreA !== match.scoreB &&
  match.winnerId !== null;

/** A stage is complete only when it has matches and all of them are done. */
export const isGroupStageComplete = (
  matches: readonly GroupStageMatch[]
): boolean =>
  matches.length > 0 && matches.every(isGroupStageMatchComplete);

export interface GroupStageProgress {
  total: number;
  completed: number;
  remaining: number;
  isComplete: boolean;
}

export const getGroupStageProgress = (
  matches: readonly GroupStageMatch[]
): GroupStageProgress => {
  const total = matches.length;
  const completed = matches.filter(isGroupStageMatchComplete).length;

  return {
    total,
    completed,
    remaining: total - completed,
    isComplete: total > 0 && completed === total,
  };
};
