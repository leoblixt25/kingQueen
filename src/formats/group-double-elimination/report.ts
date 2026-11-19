import { selectCorrections } from "./audit";
import { listEliminationMatches } from "./bracket";
import {
  normalizeTournamentCategory,
  resolveTeamDisplayName,
} from "./category";
import { compareText } from "./compare";
import { getGameLabel } from "./gameNumbers";
import type { GsdeTournamentDocument } from "./persistence";
import {
  selectCompletion,
  selectEliminationStandings,
  selectFinalResult,
  selectGlobalRanking,
  selectGroupStandings,
} from "./scoring";
import type {
  EliminationMatch,
  GroupStageMatch,
  MatchStatus,
  PlayerGender,
  TeamId,
} from "./types";

/**
 * Pure, printable view of one isolated GSDE tournament.
 *
 * The PDF renderer consumes this model only. Keeping the report independent of
 * jsPDF means the exact numbers, names and ordering can be unit-tested without
 * generating a document, and no King & Queen data can leak into the export.
 */

export interface GsdeReportPlayer {
  uid: string;
  name: string;
  gender: PlayerGender | null;
  email: string;
  teamId: string | null;
}

export interface GsdeReportTeam {
  id: TeamId;
  name: string;
  seed: number | null;
  groupId: string | null;
  groupName: string;
  players: string[];
}

export interface GsdeReportMatch {
  id: string;
  label: string;
  phase: "group" | "winners" | "losers" | "grand-final";
  groupName: string | null;
  round: number;
  teamAId: TeamId | null;
  teamBId: TeamId | null;
  teamA: string;
  teamB: string;
  scoreA: number | null;
  scoreB: number | null;
  winnerId: TeamId | null;
  status: MatchStatus;
}

export interface GsdeReportGroupStanding {
  rank: number;
  teamId: TeamId;
  team: string;
  played: number;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  pointDifference: number;
}

export interface GsdeReportGroup {
  id: string;
  name: string;
  standings: GsdeReportGroupStanding[];
  results: GsdeReportMatch[];
}

export interface GsdeReportRankingRow {
  rank: number;
  teamId: TeamId;
  team: string;
  group: string;
  groupRank: number;
  wins: number;
  losses: number;
  pointDifference: number;
}

export interface GsdeReportEliminationStanding {
  rank: number | null;
  teamId: TeamId;
  team: string;
  wins: number;
  losses: number;
  status: string;
}

export interface GsdeReportPlacement {
  place: number;
  teams: string[];
}

export interface GsdeReportCorrection {
  at: string;
  action: string;
  actor: string;
  matchId: string | null;
  detail: string;
}

export interface GsdeTournamentReport {
  id: string;
  name: string;
  title: string;
  division: string;
  category: string;
  date: string;
  status: string;
  generatedAt: string;
  counts: {
    teams: number;
    players: number;
    groups: number;
    groupMatchesCompleted: number;
    groupMatchesTotal: number;
    eliminationMatchesCompleted: number;
    eliminationMatchesTotal: number;
  };
  teams: GsdeReportTeam[];
  players: GsdeReportPlayer[];
  groups: GsdeReportGroup[];
  globalRanking: GsdeReportRankingRow[];
  eliminationMatches: GsdeReportMatch[];
  eliminationStandings: GsdeReportEliminationStanding[];
  finalPlacements: GsdeReportPlacement[];
  /** True only when central completion validation passes. */
  complete: boolean;
  validated: boolean;
  /** True for provisional/override brackets or unplayed groups. */
  provisional: boolean;
  /** Blockers from the central completion validator, safe to print. */
  completionIssues: string[];
  champions: string[];
  runnersUp: string[];
  /** Current pending reset requirement (not the historical flag). */
  resetFinalRequired: boolean;
  /** True once a reset final was appended, even after it is decided. */
  resetWasPlayed: boolean;
  corrections: GsdeReportCorrection[];
}

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  configured: "Configured",
  "group-stage": "Group stage",
  elimination: "Double elimination",
  "grand-final": "Grand Final",
  completed: "Completed",
};

const actionLabel = (action: string): string =>
  action
    .replace(/-/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

export interface BuildGsdeReportOptions {
  /** Injectable so tests and server-side callers get stable output. */
  generatedAt?: string;
}

/**
 * Assemble every printable fact from one GSDE document. Pure: no I/O, no
 * mutation and no dependency on the current date unless the caller asks for it.
 */
export const buildGsdeTournamentReport = (
  doc: GsdeTournamentDocument,
  options: BuildGsdeReportOptions = {}
): GsdeTournamentReport => {
  const registrations = doc.registrations ?? [];
  const registrationByUid = new Map(
    registrations.map((registration) => [registration.uid, registration])
  );
  const groupNameById = new Map(doc.groups.map((group) => [group.id, group.name]));
  const nameById = new Map<TeamId, string>(
    doc.teams.map((team) => [
      team.id,
      resolveTeamDisplayName(registrations, team),
    ])
  );
  const nameOf = (teamId: TeamId | null): string =>
    teamId ? nameById.get(teamId) ?? teamId : "TBD";

  const teams: GsdeReportTeam[] = [...doc.teams]
    .sort((a, b) => {
      const groupDiff = compareText(
        groupNameById.get(a.groupId ?? "") ?? "",
        groupNameById.get(b.groupId ?? "") ?? ""
      );
      if (groupDiff !== 0) return groupDiff;
      const seedDiff = (a.seed ?? Number.MAX_SAFE_INTEGER) - (b.seed ?? Number.MAX_SAFE_INTEGER);
      if (seedDiff !== 0) return seedDiff;
      const nameDiff = compareText(nameOf(a.id), nameOf(b.id));
      return nameDiff !== 0 ? nameDiff : compareText(a.id, b.id);
    })
    .map((team) => ({
      id: team.id,
      name: nameOf(team.id),
      seed: team.seed,
      groupId: team.groupId,
      groupName: team.groupId ? groupNameById.get(team.groupId) ?? team.groupId : "Unassigned",
      players: team.playerIds.map(
        (uid) => registrationByUid.get(uid)?.name?.trim() || uid
      ),
    }));

  const players: GsdeReportPlayer[] = registrations
    .map((registration) => ({
      uid: registration.uid,
      name: registration.name,
      gender: registration.gender ?? null,
      email: registration.email,
      teamId: registration.teamId,
    }))
    .sort((a, b) => {
      const nameDiff = compareText(a.name, b.name);
      return nameDiff !== 0 ? nameDiff : compareText(a.uid, b.uid);
    });

  const groupMatchToReport = (
    match: GroupStageMatch,
    _ordinal: number
  ): GsdeReportMatch => ({
    id: match.id,
    label: `R${match.round}`,
    phase: "group",
    groupName: groupNameById.get(match.groupId) ?? match.groupId,
    round: match.round,
    teamAId: match.teamAId,
    teamBId: match.teamBId,
    teamA: nameOf(match.teamAId),
    teamB: nameOf(match.teamBId),
    scoreA: match.scoreA,
    scoreB: match.scoreB,
    winnerId: match.winnerId,
    status: match.status,
  });

  const groups = selectGroupStandings(doc).map((table) => ({
    id: table.groupId,
    name: groupNameById.get(table.groupId) ?? table.groupId,
    standings: table.rows.map((row) => ({
      rank: row.rank,
      teamId: row.teamId,
      team: nameOf(row.teamId),
      played: row.played,
      wins: row.wins,
      losses: row.losses,
      pointsFor: row.pointsFor,
      pointsAgainst: row.pointsAgainst,
      pointDifference: row.pointDifference,
    })),
    results: doc.matches
      .filter((match) => match.groupId === table.groupId)
      .sort((a, b) => a.round - b.round || a.index - b.index || compareText(a.id, b.id))
      .map((match, index) => groupMatchToReport(match, index + 1)),
  }));

  const eliminationMatchToReport = (match: EliminationMatch): GsdeReportMatch => ({
    id: match.id,
    label: getGameLabel(match.id),
    phase: match.phase === "grand-final" ? "grand-final" : match.phase,
    groupName: null,
    round: match.round,
    teamAId: match.teamAId,
    teamBId: match.teamBId,
    teamA: nameOf(match.teamAId),
    teamB: nameOf(match.teamBId),
    scoreA: match.scoreA,
    scoreB: match.scoreB,
    winnerId: match.winnerId,
    status: match.status,
  });

  const eliminationMatches = doc.elimination
    ? listEliminationMatches(doc.elimination)
        .slice()
        .sort(
          (a, b) =>
            a.round - b.round || a.index - b.index || compareText(a.id, b.id)
        )
        .map(eliminationMatchToReport)
    : [];

  const globalRanking = selectGlobalRanking(doc).map((row) => ({
    rank: row.globalRank,
    teamId: row.teamId,
    team: nameOf(row.teamId),
    group: groupNameById.get(row.groupId) ?? row.groupId,
    groupRank: row.groupRank,
    wins: row.wins,
    losses: row.losses,
    pointDifference: row.pointDifference,
  }));

  const eliminationStandings = selectEliminationStandings(doc).map((row) => ({
    rank: row.rank,
    teamId: row.teamId,
    team: nameOf(row.teamId),
    wins: row.wins,
    losses: row.losses,
    status: actionLabel(row.status),
  }));

  const finalResult = selectFinalResult(doc);
  const completion = selectCompletion(doc);

  return {
    id: doc.id,
    name: doc.tournament.config.name,
    title: doc.tournament.config.name || "Group Stage + Double Elimination",
    division: doc.tournament.config.divisionName || "Open",
    category: normalizeTournamentCategory(doc.tournament.config.category),
    date: doc.tournament.config.date,
    status: STATUS_LABEL[doc.tournament.status] ?? actionLabel(doc.tournament.status),
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    counts: {
      teams: doc.teams.length,
      players: registrations.length,
      groups: doc.groups.length,
      groupMatchesCompleted: completion.groups.completed,
      groupMatchesTotal: completion.groups.total,
      eliminationMatchesCompleted: completion.elimination.completed,
      eliminationMatchesTotal: completion.elimination.total,
    },
    teams,
    players,
    groups,
    globalRanking,
    eliminationMatches,
    eliminationStandings,
    finalPlacements: finalResult.placements.map((placement) => ({
      place: placement.place,
      teams: placement.teamIds.map(nameOf),
    })),
    complete: finalResult.complete,
    validated: completion.isComplete,
    provisional:
      !completion.groups.isComplete ||
      doc.tournament.seedingStale ||
      Boolean(doc.tournament.bracketOverrideUsed),
    completionIssues: completion.issues,
    champions: finalResult.championTeamIds.map(nameOf),
    runnersUp: finalResult.runnerUpTeamIds.map(nameOf),
    resetFinalRequired: completion.resetRequired,
    resetWasPlayed: completion.resetWasPlayed,
    corrections: selectCorrections(doc).map((entry) => ({
      at: entry.at,
      action: actionLabel(entry.action),
      actor: entry.actorLabel,
      matchId: entry.matchId ?? null,
      detail: entry.detail ?? "",
    })),
  };
};
