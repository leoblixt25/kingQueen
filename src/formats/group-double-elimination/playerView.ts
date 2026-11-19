import type {
  EliminationMatch,
  Group,
  GroupStageMatch,
  MatchId,
  TeamId,
} from "./types";
import type { GsdeTournamentDocument } from "./persistence";
import { resolveTeamDisplayName } from "./category";
import {
  calculateGroupStandings,
  type GroupStanding,
} from "./groupStandings";
import { getWinner } from "./matchResult";
import { listEliminationMatches } from "./bracket";
import {
  getEliminationChampion,
  getEliminationLossCount,
} from "./progression";
import {
  calculateEliminationStandings,
  type EliminationStatus,
} from "./eliminationStandings";
import { getGameLabel, getGameNumber } from "./gameNumbers";

/**
 * Team-specific views derived from the single authoritative tournament
 * document. These selectors are pure: both the public and player pages read
 * the same data and apply the same rules, and group results are NEVER mixed
 * into elimination loss counts.
 */

export type PlayerStage =
  | "registration"
  | "group-stage"
  | "elimination"
  | "completed";

const teamGroup = (
  doc: GsdeTournamentDocument,
  teamId: TeamId
): Group | null => {
  const team = doc.teams.find((item) => item.id === teamId);
  if (!team) return null;
  const byId = doc.groups.find((item) => item.id === team.groupId);
  if (byId) return byId;
  return doc.groups.find((item) => item.teamIds.includes(teamId)) ?? null;
};

/** Current stage derived from tournament state, with a data-driven fallback. */
export const getPlayerStage = (
  doc: GsdeTournamentDocument
): PlayerStage => {
  const bracket = doc.elimination;
  if (bracket && (doc.tournament.status === "completed" || getEliminationChampion(bracket))) {
    return "completed";
  }
  if (bracket) return "elimination";
  if (doc.matches.length > 0) return "group-stage";
  return "registration";
};

export interface PlayerGroupMatch {
  matchId: MatchId;
  round: number;
  opponentId: TeamId;
  status: GroupStageMatch["status"];
  /** Scores are ordered from the selected team's point of view. */
  scoreFor: number | null;
  scoreAgainst: number | null;
  won: boolean;
}

export interface PlayerGroupView {
  teamId: TeamId;
  groupId: string | null;
  groupName: string | null;
  opponents: { teamId: TeamId; name: string }[];
  upcoming: PlayerGroupMatch[];
  results: PlayerGroupMatch[];
  standing: GroupStanding | null;
  /** Group-stage losses only. Never used as elimination losses. */
  groupLosses: number;
}

const groupMatchFor = (
  match: GroupStageMatch,
  teamId: TeamId
): PlayerGroupMatch => {
  const isA = match.teamAId === teamId;
  const scoreFor = isA ? match.scoreA : match.scoreB;
  const scoreAgainst = isA ? match.scoreB : match.scoreA;
  const won = match.status === "completed" && match.winnerId === teamId;
  return {
    matchId: match.id,
    round: match.round,
    opponentId: isA ? match.teamBId : match.teamAId,
    status: match.status,
    scoreFor,
    scoreAgainst,
    won,
  };
};

/** Assigned group, opponents, upcoming matches, results and standing. */
export const buildPlayerGroupView = (
  doc: GsdeTournamentDocument,
  teamId: TeamId
): PlayerGroupView | null => {
  if (!doc.teams.some((team) => team.id === teamId)) return null;
  const group = teamGroup(doc, teamId);

  const matches = doc.matches
    .filter((match) => match.teamAId === teamId || match.teamBId === teamId)
    .map((match) => groupMatchFor(match, teamId));

  const teamById = new Map(doc.teams.map((team) => [team.id, team]));
  const opponents = (group?.teamIds ?? [])
    .filter((id) => id !== teamId)
    .map((id) => ({
      teamId: id,
      name: (() => {
        const opponent = teamById.get(id);
        return opponent
          ? resolveTeamDisplayName(doc.registrations ?? [], opponent)
          : id;
      })(),
    }));

  const standing = group
    ? (calculateGroupStandings(group, doc.matches).rows.find(
        (row) => row.teamId === teamId
      ) ?? null)
    : null;

  return {
    teamId,
    groupId: group?.id ?? null,
    groupName: group?.name ?? null,
    opponents,
    upcoming: matches
      .filter((match) => match.status !== "completed")
      .sort((a, b) => a.round - b.round || a.matchId.localeCompare(b.matchId)),
    results: matches
      .filter((match) => match.status === "completed")
      .sort((a, b) => a.round - b.round || a.matchId.localeCompare(b.matchId)),
    standing,
    groupLosses: standing?.losses ?? 0,
  };
};

export interface PlayerEliminationMatch {
  matchId: MatchId;
  gameLabel: string;
  gameNumber: number | null;
  phase: EliminationMatch["phase"];
  round: number;
  status: EliminationMatch["status"];
  opponentId: TeamId | null;
  scoreFor: number | null;
  scoreAgainst: number | null;
  won: boolean;
}

export interface PlayerEliminationView {
  teamId: TeamId;
  /** Elimination losses only — group losses are deliberately excluded. */
  eliminationLosses: number;
  eliminationWins: number;
  status: EliminationStatus;
  competing: boolean;
  currentBracket: EliminationMatch["phase"] | null;
  nextMatch: PlayerEliminationMatch | null;
  matches: PlayerEliminationMatch[];
  finalPlace: number | null;
  eliminatedByMatchId: MatchId | null;
}

const eliminationMatchFor = (
  match: EliminationMatch,
  teamId: TeamId
): PlayerEliminationMatch | null => {
  const isA = match.teamAId === teamId;
  const isB = match.teamBId === teamId;
  if (!isA && !isB) return null;
  const gameNumber = getGameNumber(match.id);
  return {
    matchId: match.id,
    gameLabel: gameNumber === null ? match.id : getGameLabel(match.id),
    gameNumber,
    phase: match.phase,
    round: match.round,
    status: match.status,
    opponentId: isA ? match.teamBId : match.teamAId,
    scoreFor: isA ? match.scoreA : match.scoreB,
    scoreAgainst: isA ? match.scoreB : match.scoreA,
    won: getWinner(match) === teamId,
  };
};

/**
 * Bracket side, next opponent, schedule, elimination losses and
 * competing/eliminated state. A team that lost all three group matches still
 * reports ZERO elimination losses here before its first bracket loss.
 */
export const buildPlayerEliminationView = (
  doc: GsdeTournamentDocument,
  teamId: TeamId
): PlayerEliminationView | null => {
  const bracket = doc.elimination;
  if (!bracket || !doc.teams.some((team) => team.id === teamId)) return null;

  const matches = listEliminationMatches(bracket)
    .map((match) => eliminationMatchFor(match, teamId))
    .filter((match): match is PlayerEliminationMatch => match !== null)
    .sort(
      (a, b) =>
        (a.gameNumber ?? Number.MAX_SAFE_INTEGER) -
          (b.gameNumber ?? Number.MAX_SAFE_INTEGER) ||
        a.matchId.localeCompare(b.matchId)
    );

  const nextMatch =
    matches.find((match) => match.status !== "completed") ?? null;
  const latestMatch = [...matches]
    .reverse()
    .find((match) => match.status === "completed");

  const standing =
    calculateEliminationStandings(bracket).find(
      (row) => row.teamId === teamId
    ) ?? null;
  const eliminationLosses = getEliminationLossCount(bracket, teamId);
  const status: EliminationStatus =
    standing?.status ?? (eliminationLosses >= 2 ? "eliminated" : "winners");

  return {
    teamId,
    eliminationLosses,
    eliminationWins:
      matches.filter((match) => match.status === "completed" && match.won).length,
    status,
    competing: status !== "eliminated" && eliminationLosses < 2,
    currentBracket: latestMatch?.phase ?? nextMatch?.phase ?? null,
    nextMatch,
    matches,
    finalPlace: standing?.rank ?? null,
    eliminatedByMatchId: standing?.eliminatedByMatchId ?? null,
  };
};

export interface PlayerView {
  teamId: TeamId;
  teamName: string;
  stage: PlayerStage;
  group: PlayerGroupView | null;
  elimination: PlayerEliminationView | null;
}

/** Combined stage-dependent view for one team, from the authoritative doc. */
export const buildPlayerView = (
  doc: GsdeTournamentDocument,
  teamId: TeamId
): PlayerView | null => {
  const team = doc.teams.find((item) => item.id === teamId);
  if (!team) return null;
  const stage = getPlayerStage(doc);
  return {
    teamId,
    teamName: resolveTeamDisplayName(doc.registrations ?? [], team),
    stage,
    group: buildPlayerGroupView(doc, teamId),
    elimination: buildPlayerEliminationView(doc, teamId),
  };
};
