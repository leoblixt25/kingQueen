import type { GroupStageState } from "./groupStage";
import { buildGroupStage } from "./groupStage";
import {
  FIXED16_GROUP_MATCH_COUNT,
  buildFixed16EliminationStage,
  buildFixed16GroupStage,
  canGenerateFixed16Bracket,
  getFixed16GlobalRanking,
  getGlobalRanking,
  type GlobalRankingRow,
} from "./fixed16";
import type { EliminationBracket } from "./types";
import type { EliminationStage } from "./elimination";
import { buildEliminationStage } from "./elimination";
import { generateDoubleEliminationBracket } from "./bracket";
import { applySpanishCrossover } from "./spanishCrossover";
import {
  getGroupStageProgress,
  isGroupStageComplete,
} from "./groupStageMatches";
import {
  calculateAllGroupStandings,
  seedTeamsFromGroupStandings,
} from "./groupStandings";
import type { GsdeTournamentDocument } from "./persistence";
import type { Team } from "./types";

/**
 * Size-aware facade around the existing engines.
 *
 * The 16-team branch delegates to `fixed16.ts` unchanged, including the
 * mandatory Spanish crossover. Other supported sizes use the already-generic
 * `groups.ts` / `elimination.ts` / `bracket.ts` engines with four teams per
 * group. No scoring or progression rules are reimplemented here.
 */

export const isFixed16TeamCount = (teamCount: number): boolean =>
  teamCount === 16;

export const usesFixed16Engine = (
  doc: GsdeTournamentDocument,
  teams: readonly Team[] = doc.teams
): boolean =>
  isFixed16TeamCount(doc.tournament.config.teamLimit) &&
  isFixed16TeamCount(teams.length);

export const buildSizeAwareGroupStage = (
  doc: GsdeTournamentDocument,
  teams: readonly Team[]
): GroupStageState => {
  if (usesFixed16Engine(doc, teams)) return buildFixed16GroupStage(teams);

  const groupCount = doc.tournament.config.groupCount ||
    Math.max(1, Math.ceil(teams.length / 4));
  return buildGroupStage(teams, { groupCount });
};

const groupMatchCount = (teamIdsLength: number): number =>
  (teamIdsLength * (teamIdsLength - 1)) / 2;

export const expectedGroupMatchCount = (
  doc: GsdeTournamentDocument
): number => {
  if (usesFixed16Engine(doc)) return FIXED16_GROUP_MATCH_COUNT;
  if (doc.groups.length > 0) {
    return doc.groups.reduce(
      (sum, group) => sum + groupMatchCount(group.teamIds.length),
      0
    );
  }

  const groupCount = doc.tournament.config.groupCount ||
    Math.max(1, Math.ceil(doc.teams.length / 4));
  const teamsPerGroup = doc.tournament.config.teamsPerGroup ||
    (doc.teams.length > 0 ? Math.ceil(doc.teams.length / groupCount) : 4);
  return groupCount * groupMatchCount(teamsPerGroup);
};

export const canGenerateSizeAwareBracket = (
  doc: GsdeTournamentDocument
): boolean => {
  if (usesFixed16Engine(doc)) return canGenerateFixed16Bracket(doc.matches);
  return (
    isGroupStageComplete(doc.matches) &&
    getGroupStageProgress(doc.matches).total === expectedGroupMatchCount(doc)
  );
};

export const buildSizeAwareEliminationStage = (
  doc: GsdeTournamentDocument
): EliminationStage => {
  if (usesFixed16Engine(doc)) {
    return buildFixed16EliminationStage({
      groups: doc.groups,
      matches: doc.matches,
      rounds: [],
    });
  }
  return buildEliminationStage({
    groups: doc.groups,
    matches: doc.matches,
    rounds: [],
  });
};

/** Seed order used by the admin override path, including the fixed-16 crossover. */
export const buildOverrideBracket = (
  doc: GsdeTournamentDocument
): EliminationBracket => {
  const seeds = seedTeamsFromGroupStandings(
    calculateAllGroupStandings(doc.groups, doc.matches)
  );
  const bracket = generateDoubleEliminationBracket(seeds).bracket;
  return usesFixed16Engine(doc) ? applySpanishCrossover(bracket) : bracket;
};

export const getSizeAwareGlobalRanking = (
  doc: GsdeTournamentDocument
): GlobalRankingRow[] => {
  const tables = calculateAllGroupStandings(doc.groups, doc.matches);
  return usesFixed16Engine(doc)
    ? getFixed16GlobalRanking(doc.groups, doc.matches)
    : getGlobalRanking(tables);
};
