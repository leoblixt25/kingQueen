import type { EliminationBracket, MatchId, TeamId } from "./types";
import { listEliminationMatches } from "./bracket";
import {
  getEliminationChampion,
  getEliminationLossCount,
  getEliminationWinCount,
} from "./progression";

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
 * Ranks every team whose tournament is over.
 *
 * Winner 1st, deciding-final loser 2nd, then Losers Bracket rounds from the
 * last to the first. Teams eliminated in the same round share a place, so the
 * next place skips by the size of the tie (1, 2, 3, 4, 5, 5, 7, 7 …).
 */
const buildPlacementMap = (
  bracket: EliminationBracket
): Map<TeamId, number> => {
  const places = new Map<TeamId, number>();
  const champion = getEliminationChampion(bracket);

  if (champion) places.set(champion, 1);

  const deciding =
    bracket.grandFinal.find((match) => match.round === 2) ??
    bracket.grandFinal.find((match) => match.round === 1);

  if (deciding?.status === "completed" && deciding.loserId) {
    const resetTriggered =
      deciding.round === 1 &&
      deciding.teamBId !== null &&
      deciding.winnerId === deciding.teamBId;

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
