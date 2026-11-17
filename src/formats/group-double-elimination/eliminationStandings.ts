import type { EliminationBracket, MatchId, TeamId } from "./types";
import {
  findEliminationMatch,
  listEliminationMatches,
} from "./bracket";
import {
  getEliminationChampion,
  getEliminationLossCount,
  getEliminationWinCount,
} from "./progression";
import { GAME_IDS_16 } from "./gameNumbers";
import { hasSpanishCrossover } from "./spanishCrossover";

/**
 * Elimination standings and final placements.
 *
 * Only results from the elimination stage count here. Losses suffered in the
 * group stage are ignored by design, so a team that lost every group match
 * still starts this stage with zero losses.
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
    add(match.winnerId);
    add(match.loserId);
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
      match.loserId === teamId &&
      (match.phase === "losers" || match.phase === "grand-final")
  );

  return candidates.length > 0 ? candidates[candidates.length - 1].id : null;
};

/**
 * Placements for the Spanish fixed-16 crossover.
 *
 * The two semifinal winners contest the Grand Final (1st/2nd) and the two
 * semifinal losers contest the lower final (3rd/4th). When the lower final is
 * not playable because both semifinal losers already took their second loss,
 * they share 3rd. The remaining teams are placed by their Losers Bracket
 * elimination round, with teams from the same round sharing a place.
 */
const buildSpanishPlacementMap = (
  bracket: EliminationBracket
): Map<TeamId, number> => {
  const places = new Map<TeamId, number>();
  const champion = getEliminationChampion(bracket);

  if (champion) places.set(champion, 1);

  const deciding =
    bracket.grandFinal.find((match) => match.round === 2) ??
    bracket.grandFinal.find((match) => match.round === 1);

  if (
    deciding?.status === "completed" &&
    deciding.loserId &&
    !places.has(deciding.loserId)
  ) {
    places.set(deciding.loserId, 2);
  }

  const lowerFinal = findEliminationMatch(bracket, GAME_IDS_16.lowerFinal);
  if (
    lowerFinal?.status === "completed" &&
    lowerFinal.winnerId &&
    lowerFinal.loserId
  ) {
    if (!places.has(lowerFinal.winnerId)) {
      places.set(lowerFinal.winnerId, 3);
    }
    if (!places.has(lowerFinal.loserId)) {
      places.set(lowerFinal.loserId, 4);
    }
  }

  // Semifinal losers not already placed via the lower final share 3rd. This
  // covers both the "lower final not played" case and a single-team lower
  // final left over from mixed-loss semifinals.
  for (const id of [GAME_IDS_16.semiFinal1, GAME_IDS_16.semiFinal2]) {
    const semi = findEliminationMatch(bracket, id);
    if (
      semi?.status === "completed" &&
      semi.loserId &&
      !places.has(semi.loserId)
    ) {
      places.set(semi.loserId, 3);
    }
  }

  const losersRounds = [...new Set(bracket.losers.map((match) => match.round))]
    .sort((a, b) => b - a);
  let nextPlace = 5;

  for (const round of losersRounds) {
    if (lowerFinal?.round === round) continue;

    const eliminated = [
      ...new Set(
        bracket.losers
          .filter(
            (match) =>
              match.round === round &&
              match.status === "completed" &&
              match.loserId !== null &&
              getEliminationLossCount(bracket, match.loserId) >= 2
          )
          .map((match) => match.loserId as TeamId)
      ),
    ].filter((teamId) => !places.has(teamId));

    if (eliminated.length === 0) continue;
    for (const teamId of eliminated) {
      places.set(teamId, nextPlace);
    }
    nextPlace += eliminated.length;
  }

  return places;
};

/**
 * Ranks every team whose tournament is over.
 *
 * Winner 1st, deciding-final loser 2nd, then Losers Bracket rounds from the
 * last to the first. Teams eliminated in the same round share a place, so the
 * next place skips by the size of the tie (1, 2, 3, 4, 5, 5, 7, 7 …).
 */
const buildPlacementMap = (
  bracket: EliminationBracket
): Map<TeamId, number> => {
  if (hasSpanishCrossover(bracket)) {
    return buildSpanishPlacementMap(bracket);
  }

  const places = new Map<TeamId, number>();
  const champion = getEliminationChampion(bracket);

  if (champion) places.set(champion, 1);

  const deciding =
    bracket.grandFinal.find((match) => match.round === 2) ??
    bracket.grandFinal.find((match) => match.round === 1);

  if (deciding?.status === "completed" && deciding.loserId) {
    const resetTriggered =
      deciding.round === 1 &&
      deciding.loserId !== null &&
      getEliminationLossCount(bracket, deciding.loserId) === 1;

    if (!resetTriggered) places.set(deciding.loserId, 2);
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
              match.loserId !== null &&
              getEliminationLossCount(bracket, match.loserId) >= 2
          )
          .map((match) => match.loserId as TeamId)
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
