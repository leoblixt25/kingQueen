import type { EliminationBracket, TeamId } from "./types";
import type { GroupStageState } from "./groupStage";
import { generateDoubleEliminationBracket } from "./bracket";
import { isGroupStageComplete } from "./groupStageMatches";
import {
  calculateAllGroupStandings,
  seedTeamsFromGroupStandings,
} from "./groupStandings";
import { EliminationError } from "./errors";

/**
 * Bridge from the Group Stage to the elimination stage.
 *
 * This is the only place that reads group data. The produced bracket keeps
 * no group records: it receives the qualified teams already ordered by
 * `seedTeamsFromGroupStandings()`, and every team starts with zero
 * elimination-stage losses.
 */
export interface EliminationStage {
  bracket: EliminationBracket;
  seededTeamIds: TeamId[];
}

export interface BuildEliminationOptions {
  /** Preview support: seed from a partially played group stage. */
  allowIncompleteGroupStage?: boolean;
  /** Configured in-group tiebreaker order, used to derive group ranks. */
  tiebreakers?: readonly string[];
}

export const buildEliminationStage = (
  stage: GroupStageState,
  options: BuildEliminationOptions = {}
): EliminationStage => {
  if (
    !options.allowIncompleteGroupStage &&
    !isGroupStageComplete(stage.matches)
  ) {
    throw new EliminationError(
      "group-stage-incomplete",
      "The group stage must be complete before the elimination bracket is seeded."
    );
  }

  const tables = calculateAllGroupStandings(
    stage.groups,
    stage.matches,
    options.tiebreakers
  );
  const seededTeamIds = seedTeamsFromGroupStandings(tables);
  const plan = generateDoubleEliminationBracket(seededTeamIds);

  return { bracket: plan.bracket, seededTeamIds: plan.seededTeamIds };
};
