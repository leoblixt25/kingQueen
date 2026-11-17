import type { GsdeTournamentDocument } from "./persistence";
import { listEliminationMatches } from "./bracket";
import { isGroupStageMatchComplete } from "./groupStageMatches";

/**
 * Central integrity checks. A transition is only allowed to persist if the
 * resulting document passes these checks; a completed match can therefore
 * never leave the bracket in a silently inconsistent state.
 */

export type IntegrityCode =
  | "duplicate-team-id"
  | "duplicate-group-id"
  | "duplicate-group-match-id"
  | "duplicate-elimination-match-id"
  | "overlapping-match-id"
  | "invalid-group-size"
  | "incomplete-group-match"
  | "invalid-group-participants"
  | "invalid-seed-count"
  | "invalid-elimination-result"
  | "broken-progression-link";

export interface IntegrityIssue {
  code: IntegrityCode;
  message: string;
}

const duplicates = (values: readonly string[]): string[] => {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) repeated.add(value);
    seen.add(value);
  }
  return [...repeated];
};

export class IntegrityError extends Error {
  readonly issues: IntegrityIssue[];

  constructor(issues: IntegrityIssue[]) {
    super(`Tournament integrity check failed: ${issues.map((issue) => issue.message).join("; ")}`);
    this.name = "IntegrityError";
    this.issues = issues;
  }
}

export const validateTournamentIntegrity = (
  doc: GsdeTournamentDocument
): IntegrityIssue[] => {
  const issues: IntegrityIssue[] = [];
  const add = (code: IntegrityCode, message: string) =>
    issues.push({ code, message });

  for (const id of duplicates(doc.teams.map((team) => team.id))) {
    add("duplicate-team-id", `Duplicate team id "${id}".`);
  }
  for (const id of duplicates(doc.groups.map((group) => group.id))) {
    add("duplicate-group-id", `Duplicate group id "${id}".`);
  }

  const groupIds = new Set(doc.groups.map((group) => group.id));
  const eliminationMatches = doc.elimination
    ? listEliminationMatches(doc.elimination)
    : [];

  for (const id of duplicates(doc.matches.map((match) => match.id))) {
    add("duplicate-group-match-id", `Duplicate group match id "${id}".`);
  }
  for (const id of duplicates(eliminationMatches.map((match) => match.id))) {
    add("duplicate-elimination-match-id", `Duplicate elimination match id "${id}".`);
  }
  const groupMatchIds = new Set(doc.matches.map((match) => match.id));
  for (const match of eliminationMatches) {
    if (groupMatchIds.has(match.id)) {
      add("overlapping-match-id", `Match id "${match.id}" used in both stages.`);
    }
  }

  for (const group of doc.groups) {
    if (group.teamIds.length !== 4) {
      add("invalid-group-size", `Group "${group.id}" does not have 4 teams.`);
    }
    if (duplicates(group.teamIds).length > 0) {
      add("invalid-group-size", `Group "${group.id}" has duplicate teams.`);
    }
  }

  for (const match of doc.matches) {
    if (!groupIds.has(match.groupId)) {
      add("invalid-group-participants", `Match "${match.id}" has unknown group.`);
    }
    if (!match.teamAId || !match.teamBId || match.teamAId === match.teamBId) {
      add("invalid-group-participants", `Match "${match.id}" has invalid participants.`);
    }
    if (match.status === "completed" && !isGroupStageMatchComplete(match)) {
      add("incomplete-group-match", `Completed match "${match.id}" is missing result data.`);
    }
  }

  const seeds = doc.elimination?.seededTeamIds ?? [];
  if (doc.elimination && (seeds.length !== 16 || duplicates(seeds).length > 0)) {
    add("invalid-seed-count", "Elimination bracket must have 16 unique seeds.");
  }

  const eliminationIds = new Set(eliminationMatches.map((match) => match.id));
  for (const match of eliminationMatches) {
    if (
      match.status === "completed" &&
      (!match.winnerId ||
        !match.loserId ||
        match.winnerId === match.loserId ||
        ![match.teamAId, match.teamBId].includes(match.winnerId) ||
        ![match.teamAId, match.teamBId].includes(match.loserId))
    ) {
      add(
        "invalid-elimination-result",
        `Completed elimination match "${match.id}" has invalid winner/loser.`
      );
    }
    for (const link of [match.winnerTo, match.loserTo]) {
      if (link && !eliminationIds.has(link.matchId)) {
        add(
          "broken-progression-link",
          `Match "${match.id}" links to unknown match "${link.matchId}".`
        );
      }
    }
  }

  return issues;
};

/** Throw on any integrity issue; used after every scored transition. */
export const assertTournamentIntegrity = (
  doc: GsdeTournamentDocument
): void => {
  const issues = validateTournamentIntegrity(doc);
  if (issues.length > 0) throw new IntegrityError(issues);
};
