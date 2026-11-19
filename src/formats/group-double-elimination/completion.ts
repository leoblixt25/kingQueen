import type { GsdeTournamentDocument } from "./persistence";
import { listEliminationMatches } from "./bracket";
import { calculateAllGroupStandings, seedTeamsFromGroupStandings } from "./groupStandings";
import { getGroupStageProgress, isGroupStageMatchComplete } from "./groupStageMatches";
import { expectedGroupMatchCount } from "./sizeAware";
import {
  getEliminationChampion,
  getLosersBracketChampion,
  getWinnersBracketChampion,
  needsGrandFinalReset,
} from "./progression";
import { validateFinalPlacements } from "./eliminationStandings";
import type { TeamId } from "./types";

/**
 * Single source of truth for "is this tournament finished?".
 *
 * A tournament is complete only when the group schedule is valid and fully
 * played, the bracket was seeded from those final standings, every required
 * elimination match is resolved, both bracket champions and the (possibly
 * reset) Grand Final are decided, placements are consistent, and no match is
 * left for admin review after a correction.
 *
 * Every consumer — status, progress, final result, report and PDF — reads this
 * validator so a half-played bracket can never be presented as completed.
 */

export interface TournamentCompletion {
  isComplete: boolean;
  /** Human-readable blockers, safe to display in admin and reports. */
  issues: string[];
  groups: {
    total: number;
    completed: number;
    isComplete: boolean;
  };
  elimination: {
    total: number;
    completed: number;
    reviewRequired: number;
  };
  resetRequired: boolean;
  /** True when a reset final was appended (historical marker). */
  resetWasPlayed: boolean;
  champion: TeamId | null;
}

const pairKey = (a: TeamId, b: TeamId): string =>
  [a, b].slice().sort().join("|");

const sameOrder = (a: readonly TeamId[], b: readonly TeamId[]): boolean =>
  a.length === b.length && a.every((teamId, index) => teamId === b[index]);

/**
 * Verify the stored group matches are exactly the round robin implied by the
 * groups: each group has every unique pair once, participants belong to the
 * group, and no match references an unknown group.
 */
const validateGroupSchedule = (doc: GsdeTournamentDocument): string[] => {
  const issues: string[] = [];
  const knownGroupIds = new Set(doc.groups.map((group) => group.id));

  for (const match of doc.matches) {
    if (!knownGroupIds.has(match.groupId)) {
      issues.push(`Group match "${match.id}" references unknown group "${match.groupId}".`);
    }
  }

  for (const group of doc.groups) {
    const groupMembers = new Set(group.teamIds);
    const groupMatches = doc.matches.filter((match) => match.groupId === group.id);
    const expected = new Set<string>();

    for (let i = 0; i < group.teamIds.length; i += 1) {
      for (let j = i + 1; j < group.teamIds.length; j += 1) {
        expected.add(pairKey(group.teamIds[i], group.teamIds[j]));
      }
    }

    const actual = new Set<string>();
    for (const match of groupMatches) {
      if (!groupMembers.has(match.teamAId) || !groupMembers.has(match.teamBId)) {
        issues.push(
          `Group match "${match.id}" has a participant outside group "${group.id}".`
        );
        continue;
      }
      const key = pairKey(match.teamAId, match.teamBId);
      if (actual.has(key)) {
        issues.push(`Group "${group.id}" has duplicate pair ${key.replace("|", " vs ")}.`);
      }
      actual.add(key);
    }

    for (const key of expected) {
      if (!actual.has(key)) {
        issues.push(`Group "${group.id}" is missing pair ${key.replace("|", " vs ")}.`);
      }
    }
    for (const key of actual) {
      if (!expected.has(key)) {
        issues.push(`Group "${group.id}" has unexpected pair ${key.replace("|", " vs ")}.`);
      }
    }
  }

  return issues;
};

export const validateTournamentCompletion = (
  doc: GsdeTournamentDocument
): TournamentCompletion => {
  const issues: string[] = [];

  // --- Group stage -------------------------------------------------------
  issues.push(...validateGroupSchedule(doc));

  const expectedGroups = expectedGroupMatchCount(doc);
  const groupProgress = getGroupStageProgress(doc.matches);
  const groupsComplete =
    groupProgress.isComplete &&
    groupProgress.total === expectedGroups &&
    expectedGroups > 0 &&
    doc.matches.every(isGroupStageMatchComplete);

  if (!groupsComplete) {
    issues.push(
      `Group stage incomplete: ${groupProgress.completed}/${expectedGroups} matches are valid and complete.`
    );
  }
  if (!doc.tournament.groupStageVerified) {
    issues.push("The final group standings have not been verified.");
  }
  if (doc.tournament.seedingStale) {
    issues.push(
      "The bracket was seeded from provisional group standings; regenerate it after the group stage is complete."
    );
  }
  if (doc.tournament.bracketOverrideUsed && !doc.tournament.groupStageVerified) {
    issues.push("The bracket was generated with an admin override; regenerate it from verified standings.");
  }

  const bracket = doc.elimination;
  if (!bracket) {
    issues.push("The elimination bracket has not been generated.");
    return {
      isComplete: false,
      issues,
      groups: {
        total: groupProgress.total,
        completed: groupProgress.completed,
        isComplete: groupsComplete,
      },
      elimination: { total: 0, completed: 0, reviewRequired: 0 },
      resetRequired: false,
      resetWasPlayed: false,
      champion: null,
    };
  }

  // Seeding must come from the validated final standings.
  if (groupsComplete) {
    const expectedSeeds = seedTeamsFromGroupStandings(
      calculateAllGroupStandings(doc.groups, doc.matches, doc.settings.groupTiebreakers)
    );
    if (!sameOrder(bracket.seededTeamIds, expectedSeeds)) {
      issues.push("The bracket seeds no longer match the validated group standings.");
    }
  }

  // --- Elimination stage -------------------------------------------------
  const allMatches = listEliminationMatches(bracket);
  const reviewRequired = allMatches.filter((match) => match.reviewRequired);
  if (reviewRequired.length > 0) {
    issues.push(
      `${reviewRequired.length} elimination match(es) require review after a score correction.`
    );
  }

  const unresolved = allMatches.filter(
    (match) => match.teamAId !== null && match.teamBId !== null && match.status !== "completed"
  );
  if (unresolved.length > 0) {
    issues.push(`${unresolved.length} elimination match(es) are still unresolved.`);
  }

  const winnersChampion = getWinnersBracketChampion(bracket);
  const losersChampion = getLosersBracketChampion(bracket);
  if (!winnersChampion) issues.push("The Winners Bracket champion is not decided.");
  if (!losersChampion) issues.push("The Losers Bracket champion is not decided.");

  const resetRequired = needsGrandFinalReset(bracket);
  const champion = getEliminationChampion(bracket);
  if (resetRequired) issues.push("A reset final is required to decide the champion.");
  if (!champion) issues.push("No tournament champion has been decided.");

  const firstFinal = bracket.grandFinal.find((match) => match.round === 1);
  if (!firstFinal || firstFinal.status !== "completed") {
    issues.push("The Grand Final is not complete.");
  } else if (winnersChampion && losersChampion) {
    if (firstFinal.teamAId !== winnersChampion || firstFinal.teamBId !== losersChampion) {
      issues.push("The Grand Final finalists are not the Winners and Losers Bracket champions.");
    }
  }

  const placementCheck = validateFinalPlacements(bracket, true);
  issues.push(...placementCheck.issues);

  return {
    isComplete: issues.length === 0,
    issues,
    groups: {
      total: groupProgress.total,
      completed: groupProgress.completed,
      isComplete: groupsComplete,
    },
    elimination: {
      total: allMatches.length,
      completed: allMatches.filter((match) => match.status === "completed").length,
      reviewRequired: reviewRequired.length,
    },
    resetRequired,
    resetWasPlayed: bracket.grandFinal.some((match) => match.round === 2),
    champion,
  };
};
