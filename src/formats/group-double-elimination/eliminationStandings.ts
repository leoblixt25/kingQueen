import type { EliminationBracket, MatchId, TeamId } from "./types";
import { getLoser, getWinner } from "./matchResult";
import { listEliminationMatches, loserMatchId } from "./bracket";
import { GAME_IDS_16 } from "./gameNumbers";
import {
  getEliminationChampion,
  getEliminationLossCount,
  getEliminationWinCount,
  needsGrandFinalReset,
} from "./progression";

/**
 * Elimination standings and final placements.
 *
 * Only results from the elimination stage count here. Losses suffered in the
 * group stage are ignored by design, so a team that lost every group match
 * still starts this stage with zero losses.
 *
 * Placement is derived from bracket outcomes, never from seed order or array
 * order: champion, deciding-final loser, then Losers Bracket elimination
 * rounds from last to first. Teams eliminated in the same round share a place.
 */
export type EliminationStatus =
  | "winners"
  | "losers"
  | "eliminated"
  | "champion";

export interface EliminationStanding {
  /** `null` while the team is still alive and its final place is unknown. */
  rank: number | null;
  teamId: TeamId;
  wins: number;
  losses: number;
  status: EliminationStatus;
  eliminatedByMatchId: MatchId | null;
}

/** One final placement, shared by every team tied at that place. */
export interface FinalPlacement {
  place: number;
  teamIds: TeamId[];
}

const collectTeamIds = (bracket: EliminationBracket): TeamId[] => {
  const ids: TeamId[] = [];
  const seen = new Set<TeamId>();

  const add = (teamId: TeamId | null | undefined): void => {
    if (!teamId || seen.has(teamId)) return;
    seen.add(teamId);
    ids.push(teamId);
  };

  bracket.seededTeamIds?.forEach(add);

  for (const match of listEliminationMatches(bracket)) {
    add(match.teamAId);
    add(match.teamBId);
    add(getWinner(match));
    add(getLoser(match));
  }

  return ids;
};

const eliminationMatchFor = (
  bracket: EliminationBracket,
  teamId: TeamId
): MatchId | null => {
  const candidates = listEliminationMatches(bracket).filter(
    (match) =>
      match.status === "completed" &&
      getLoser(match) === teamId &&
      (match.phase === "losers" || match.phase === "grand-final")
  );

  return candidates.length > 0 ? candidates[candidates.length - 1].id : null;
};

const buildPlacementMap = (
  bracket: EliminationBracket
): Map<TeamId, number> => {
  const places = new Map<TeamId, number>();
  const champion = getEliminationChampion(bracket);

  if (champion) places.set(champion, 1);

  const deciding =
    bracket.grandFinal.find((match) => match.round === 2) ??
    bracket.grandFinal.find((match) => match.round === 1);

  if (deciding?.status === "completed" && !needsGrandFinalReset(bracket)) {
    const runnerUp = getLoser(deciding);
    if (runnerUp) places.set(runnerUp, 2);
  }

  // Fixed 16-team bracket: derive each place from the exact game that
  // eliminated the team. This guarantees 3rd comes from Game 29, 4th from
  // Game 28, and the shared places from the corresponding LB rounds.
  const byId = new Map(listEliminationMatches(bracket).map((match) => [match.id, match]));
  if (bracket.bracketSize === 16 && byId.has(GAME_IDS_16.lowerFinal)) {
    const placeLosers = (ids: readonly MatchId[], place: number): void => {
      for (const id of ids) {
        const match = byId.get(id);
        const eliminated = match?.status === "completed" ? getLoser(match) : null;
        if (
          eliminated &&
          getEliminationLossCount(bracket, eliminated) >= 2 &&
          !places.has(eliminated)
        ) {
          places.set(eliminated, place);
        }
      }
    };

    placeLosers([GAME_IDS_16.lowerFinal], 3);
    placeLosers([GAME_IDS_16.semiFinal2], 4);
    placeLosers([GAME_IDS_16.game25, GAME_IDS_16.game26], 5);
    placeLosers([loserMatchId(3, 1), loserMatchId(3, 2)], 7);
    placeLosers(
      [1, 2, 3, 4].map((index) => loserMatchId(2, index)),
      9
    );
    placeLosers(
      [1, 2, 3, 4].map((index) => loserMatchId(1, index)),
      13
    );
    return places;
  }

  const rounds = [...new Set(bracket.losers.map((match) => match.round))].sort(
    (a, b) => b - a
  );

  // Each Losers Bracket match eliminates exactly one team, so the place of a
  // round depends on how many matches are still to come: the later the round,
  // the better the place. Ties within a round share the place.
  let laterMatches = 0;

  for (const round of rounds) {
    const matchesInRound = bracket.losers.filter(
      (match) => match.round === round
    ).length;
    const place = 3 + laterMatches;

    const eliminated = [
      ...new Set(
        bracket.losers
          .filter(
            (match) =>
              match.round === round &&
              match.status === "completed" &&
              getLoser(match) !== null &&
              getEliminationLossCount(bracket, getLoser(match) as TeamId) >= 2
          )
          .map((match) => getLoser(match) as TeamId)
      ),
    ].filter((teamId) => !places.has(teamId));

    for (const teamId of eliminated) {
      places.set(teamId, place);
    }

    laterMatches += matchesInRound;
  }

  return places;
};

export const calculateFinalPlacements = (
  bracket: EliminationBracket
): FinalPlacement[] => {
  const places = buildPlacementMap(bracket);
  const byPlace = new Map<number, TeamId[]>();

  for (const [teamId, place] of places) {
    const block = byPlace.get(place);
    if (block) {
      block.push(teamId);
    } else {
      byPlace.set(place, [teamId]);
    }
  }

  return [...byPlace.keys()]
    .sort((a, b) => a - b)
    .map((place) => ({ place, teamIds: byPlace.get(place) ?? [] }));
};

export interface PlacementValidation {
  isConsistent: boolean;
  issues: string[];
}

/**
 * Cross-check placements against the bracket. With `requireComplete`, every
 * seeded team must appear exactly once and 1st/2nd must each be a single team.
 */
export const validateFinalPlacements = (
  bracket: EliminationBracket,
  requireComplete = false
): PlacementValidation => {
  const issues: string[] = [];
  const placements = calculateFinalPlacements(bracket);
  const champion = getEliminationChampion(bracket);
  const placeOne = placements.find((placement) => placement.place === 1);
  const placeTwo = placements.find((placement) => placement.place === 2);

  if (champion && (!placeOne || placeOne.teamIds.length !== 1 || placeOne.teamIds[0] !== champion)) {
    issues.push("The champion is not the sole team in 1st place.");
  }
  if (champion && placeTwo && placeTwo.teamIds.length !== 1) {
    issues.push("More than one team is listed in 2nd place.");
  }

  const allPlaced = placements.flatMap((placement) => placement.teamIds);
  const duplicates = allPlaced.filter(
    (teamId, index) => allPlaced.indexOf(teamId) !== index
  );
  if (duplicates.length > 0) {
    issues.push(`Duplicate final placements: ${[...new Set(duplicates)].join(", ")}.`);
  }

  if (requireComplete) {
    const expected = bracket.seededTeamIds ?? collectTeamIds(bracket);
    const missing = expected.filter((teamId) => !allPlaced.includes(teamId));
    const unexpected = allPlaced.filter((teamId) => !expected.includes(teamId));
    if (missing.length > 0) {
      issues.push(`Unplaced teams: ${missing.join(", ")}.`);
    }
    if (unexpected.length > 0) {
      issues.push(`Placed teams outside the bracket: ${unexpected.join(", ")}.`);
    }
    if (!placeOne || placeOne.teamIds.length !== 1) {
      issues.push("A completed tournament needs exactly one champion.");
    }
    if (!placeTwo || placeTwo.teamIds.length !== 1) {
      issues.push("A completed tournament needs exactly one runner-up.");
    }
  }

  return { isConsistent: issues.length === 0, issues };
};

export const calculateEliminationStandings = (
  bracket: EliminationBracket
): EliminationStanding[] => {
  const places = buildPlacementMap(bracket);
  const champion = getEliminationChampion(bracket);

  return collectTeamIds(bracket)
    .map((teamId) => {
      const wins = getEliminationWinCount(bracket, teamId);
      const losses = getEliminationLossCount(bracket, teamId);

      const status: EliminationStatus =
        teamId === champion
          ? "champion"
          : losses >= 2
            ? "eliminated"
            : losses === 1
              ? "losers"
              : "winners";

      return {
        rank: teamId === champion ? 1 : places.get(teamId) ?? null,
        teamId,
        wins,
        losses,
        status,
        eliminatedByMatchId:
          losses >= 2 ? eliminationMatchFor(bracket, teamId) : null,
      };
    })
    .sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity));
};
