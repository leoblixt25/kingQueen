import type {
  BracketLink,
  EliminationBracket,
  EliminationMatch,
  MatchId,
  TeamId,
} from "./types";
import { EliminationError } from "./errors";
import {
  GRAND_FINAL_TWO_ID,
  findEliminationMatch,
  listEliminationMatches,
  replaceEliminationMatch,
} from "./bracket";
import { chooseRematchSafeDrop } from "./rematchPrevention";

/**
 * Elimination progression.
 *
 * One completed match at a time: the winner advances, the loser drops to the
 * Losers Bracket or leaves the tournament, and the Grand Final decides
 * whether a reset match is needed. Elimination losses are counted only from
 * elimination-stage matches, so group-stage records can never eliminate a
 * team here.
 */

export interface EliminationMatchOutcome {
  matchId: MatchId;
  winnerId: TeamId;
  loserId: TeamId;
  /** Optional single-set scores, in `teamA` / `teamB` order. */
  scoreA?: number | null;
  scoreB?: number | null;
}

export interface EliminationAdvanceResult {
  bracket: EliminationBracket;
  /** Set when the loss is the team's second elimination-stage loss. */
  eliminatedTeamId: TeamId | null;
  /** Set when the Losers champion wins the first Grand Final. */
  resetFinalRequired: boolean;
}

export interface EliminationAdvanceOptions {
  /**
   * Redirect a loser to a different Losers match in the same round when the
   * same-index target would be an immediate rematch. Used by the fixed
   * 16-team format; the general engine keeps canonical routing by default.
   */
  avoidRematches?: boolean;
}

const isScore = (value: number | null | undefined): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 0;

export const getEliminationLossCount = (
  bracket: EliminationBracket,
  teamId: TeamId
): number =>
  listEliminationMatches(bracket).filter(
    (match) => match.status === "completed" && match.loserId === teamId
  ).length;

export const getEliminationWinCount = (
  bracket: EliminationBracket,
  teamId: TeamId
): number =>
  listEliminationMatches(bracket).filter(
    (match) => match.status === "completed" && match.winnerId === teamId
  ).length;

const fillSlot = (
  bracket: EliminationBracket,
  link: BracketLink,
  teamId: TeamId
): EliminationBracket => {
  const target = findEliminationMatch(bracket, link.matchId);

  if (!target) {
    throw new EliminationError(
      "invalid-bracket",
      `"${link.matchId}" does not exist.`
    );
  }
  if (target.status === "completed") {
    throw new EliminationError(
      "invalid-bracket",
      `"${target.id}" is already completed and cannot receive a team.`
    );
  }

  const current = link.slot === "teamA" ? target.teamAId : target.teamBId;
  if (current && current !== teamId) {
    throw new EliminationError(
      "invalid-bracket",
      `"${target.id}" ${link.slot} is already filled by "${current}".`
    );
  }

  const other = link.slot === "teamA" ? target.teamBId : target.teamAId;
  if (other === teamId) {
    throw new EliminationError(
      "invalid-bracket",
      `"${teamId}" would appear twice in "${target.id}".`
    );
  }

  const updated: EliminationMatch = {
    ...target,
    teamAId: link.slot === "teamA" ? teamId : target.teamAId,
    teamBId: link.slot === "teamB" ? teamId : target.teamBId,
  };

  if (updated.teamAId && updated.teamBId) {
    updated.status = "ready";
  }

  return replaceEliminationMatch(bracket, updated);
};

/**
 * A reset is required when the team that lost the first Grand Final came into
 * it undefeated (so it now has exactly one loss). That is the "undefeated
 * finalist loses once" case the reset exists to correct. Detection is by loss
 * count rather than bracket slot, so it works for the Spanish crossover where
 * the final slots carry mixed loss counts.
 */
const firstFinalRequiresReset = (
  bracket: EliminationBracket,
  firstFinal: EliminationMatch | undefined
): boolean =>
  Boolean(
    firstFinal?.status === "completed" &&
      firstFinal.loserId &&
      getEliminationLossCount(bracket, firstFinal.loserId) === 1
  );

const appendResetFinal = (
  bracket: EliminationBracket,
  firstFinal: EliminationMatch
): EliminationBracket => {
  if (bracket.grandFinal.some((match) => match.id === GRAND_FINAL_TWO_ID)) {
    return bracket;
  }

  const reset: EliminationMatch = {
    id: GRAND_FINAL_TWO_ID,
    phase: "grand-final",
    round: 2,
    index: 1,
    teamAId: firstFinal.teamAId,
    teamBId: firstFinal.teamBId,
    scoreA: null,
    scoreB: null,
    status: "ready",
    winnerId: null,
    loserId: null,
    winnerTo: null,
    loserTo: null,
  };

  return {
    ...bracket,
    grandFinal: [...bracket.grandFinal, reset],
    resetFinalRequired: true,
  };
};

export const advanceEliminationMatch = (
  bracket: EliminationBracket,
  outcome: EliminationMatchOutcome,
  options: EliminationAdvanceOptions = {}
): EliminationAdvanceResult => {
  const match = findEliminationMatch(bracket, outcome.matchId);

  if (!match) {
    throw new EliminationError(
      "unknown-match",
      `No elimination match "${outcome.matchId}".`
    );
  }
  if (match.status === "completed") {
    throw new EliminationError(
      "match-completed",
      `"${match.id}" is already completed.`
    );
  }
  if (!match.teamAId || !match.teamBId) {
    throw new EliminationError(
      "invalid-match",
      `"${match.id}" is still waiting for its teams.`
    );
  }

  const { winnerId, loserId } = outcome;
  const winnerIsA = winnerId === match.teamAId;
  const winnerIsB = winnerId === match.teamBId;
  const loserIsA = loserId === match.teamAId;
  const loserIsB = loserId === match.teamBId;

  if (!((winnerIsA && loserIsB) || (winnerIsB && loserIsA))) {
    throw new EliminationError(
      "invalid-outcome",
      `"${match.id}" is played by "${match.teamAId}" and "${match.teamBId}".`
    );
  }

  const hasScores = outcome.scoreA != null || outcome.scoreB != null;
  if (hasScores) {
    if (!isScore(outcome.scoreA) || !isScore(outcome.scoreB)) {
      throw new EliminationError(
        "invalid-outcome",
        "Scores must be non-negative integers."
      );
    }
    if (outcome.scoreA === outcome.scoreB) {
      throw new EliminationError(
        "invalid-outcome",
        "Single-set matches cannot end in a tie."
      );
    }
    const scoreWinnerIsA = outcome.scoreA > outcome.scoreB;
    if (scoreWinnerIsA !== winnerIsA) {
      throw new EliminationError(
        "invalid-outcome",
        "Scores and winner do not agree."
      );
    }
  }

  const completed: EliminationMatch = {
    ...match,
    scoreA: outcome.scoreA ?? null,
    scoreB: outcome.scoreB ?? null,
    status: "completed",
    winnerId,
    loserId,
  };

  let next = replaceEliminationMatch(bracket, completed);

  if (completed.winnerTo) {
    next = fillSlot(next, completed.winnerTo, winnerId);
  }

  const loserLosses = getEliminationLossCount(next, loserId);
  if (completed.loserTo && loserLosses < 2) {
    // A team on its second loss is eliminated and must not be placed into a
    // following match (relevant for the Spanish tail's crossover semifinals).
    let link = completed.loserTo;
    if (options.avoidRematches) {
      const drop = chooseRematchSafeDrop(next, completed.id, loserId);
      next = drop.bracket;
      link = drop.link;
    }
    next = fillSlot(next, link, loserId);
  }

  let eliminatedTeamId: TeamId | null = loserLosses >= 2 ? loserId : null;
  let resetFinalRequired = next.resetFinalRequired;

  const isFirstGrandFinal =
    completed.phase === "grand-final" && completed.round === 1;

  if (isFirstGrandFinal && firstFinalRequiresReset(next, completed)) {
    next = appendResetFinal(next, completed);
    eliminatedTeamId = null;
    resetFinalRequired = true;
  }

  return { bracket: next, eliminatedTeamId, resetFinalRequired };
};

/** True while the reset final is still required and not yet completed. */
export const needsGrandFinalReset = (
  bracket: EliminationBracket
): boolean => {
  const first = bracket.grandFinal.find((match) => match.round === 1);
  const second = bracket.grandFinal.find((match) => match.round === 2);

  if (!first || first.status !== "completed") return false;
  if (second) return second.status !== "completed";

  return firstFinalRequiresReset(bracket, first);
};

/** Tournament champion, `null` until the deciding final is complete. */
export const getEliminationChampion = (
  bracket: EliminationBracket
): TeamId | null => {
  const second = bracket.grandFinal.find((match) => match.round === 2);
  if (second?.status === "completed") {
    return second.winnerId;
  }

  const first = bracket.grandFinal.find((match) => match.round === 1);
  // The first final decides the title unless a reset is still outstanding.
  // A champion may legitimately have one loss in the Spanish crossover, when
  // the runner-up also entered the final with a loss.
  if (
    first?.status === "completed" &&
    first.winnerId &&
    !firstFinalRequiresReset(bracket, first)
  ) {
    return first.winnerId;
  }

  return null;
};

export const isEliminationComplete = (
  bracket: EliminationBracket
): boolean =>
  getEliminationChampion(bracket) !== null &&
  listEliminationMatches(bracket).every(
    (match) =>
      match.status === "completed" ||
      match.teamAId === null ||
      match.teamBId === null
  );
