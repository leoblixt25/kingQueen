import { compareText } from "./compare";
import { getTeamPlayerNames, resolveTeamDisplayName } from "./category";
import { getGameLabel } from "./gameNumbers";
import type { GroupTiebreaker } from "./groupStandings";
import { getLosersBracketRounds, getLosersChampion } from "./losersBracket";
import { getWinnersBracketRounds, getWinnersChampion } from "./winnersBracket";
import { getLoser, getWinner } from "./matchResult";
import type { GsdeTournamentDocument } from "./persistence";
import {
  findRegistrationByEmail,
  getRegisteredTeamId,
} from "./registration";
import {
  selectCompletion,
  selectFinalResult,
  selectGlobalRanking,
  selectGroupStandings,
  selectProgress,
} from "./scoring";
import type { BracketLink, EliminationMatch, TeamId } from "./types";

/** Read-only team identity used in every overview card. */
export interface OverviewTeamRef {
  id: TeamId;
  name: string;
  players: string[];
  seed: number | null;
}

/** Placeholder for an unresolved elimination slot. */
export interface OverviewMatchTeam extends OverviewTeamRef {
  id: TeamId | null;
}

export interface OverviewGroupTeam extends OverviewTeamRef {
  rank: number;
  played: number;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  pointDifference: number;
  tiebreakUsed: GroupTiebreaker | null;
  qualified: boolean;
  globalRank: number | null;
  /** Canonical first elimination game for this team, from the saved bracket. */
  entryGame: string | null;
  entryRound: string | null;
  isLeader: boolean;
  isViewerTeam: boolean;
}

export interface OverviewGroup {
  id: string;
  name: string;
  teams: OverviewGroupTeam[];
  qualifiedCount: number;
  totalCount: number;
}

export interface OverviewBracketMatch {
  id: string;
  gameLabel: string;
  round: number;
  index: number;
  status: EliminationMatch["status"];
  reviewRequired: boolean;
  teamA: OverviewMatchTeam;
  teamB: OverviewMatchTeam;
  scoreA: number | null;
  scoreB: number | null;
  winnerId: TeamId | null;
  loserId: TeamId | null;
  winnerTo: string | null;
  loserTo: string | null;
}

export interface OverviewBracketRound {
  round: number;
  label: string;
  matches: OverviewBracketMatch[];
}

export interface OverviewGrandFinal {
  matches: OverviewBracketMatch[];
  winnersChampionId: TeamId | null;
  losersChampionId: TeamId | null;
  championTeamIds: TeamId[];
  runnerUpTeamIds: TeamId[];
  resetRequired: boolean;
  resetWasPlayed: boolean;
  complete: boolean;
}

export interface GsdeOverviewModel {
  groups: OverviewGroup[];
  leftGroups: OverviewGroup[];
  rightGroups: OverviewGroup[];
  winnersRounds: OverviewBracketRound[];
  losersRounds: OverviewBracketRound[];
  grandFinal: OverviewGrandFinal;
  teamRefs: Map<TeamId, OverviewTeamRef>;
  bracketGenerated: boolean;
  advanceAllTeams: boolean;
  qualifiedCount: number;
  teamCount: number;
  progress: ReturnType<typeof selectProgress>;
  completion: ReturnType<typeof selectCompletion>;
}

const UNKNOWN_TEAM: OverviewMatchTeam = {
  id: null,
  name: "TBD",
  players: [],
  seed: null,
};

const linkLabel = (link: BracketLink | null): string | null =>
  link
    ? `${getGameLabel(link.matchId)} · ${link.slot === "teamA" ? "A" : "B"}`
    : null;

const buildTeamRefs = (
  doc: GsdeTournamentDocument
): Map<TeamId, OverviewTeamRef> => {
  const registrations = doc.registrations ?? [];
  return new Map(
    doc.teams.map((team) => [
      team.id,
      {
        id: team.id,
        name: resolveTeamDisplayName(registrations, team),
        players: getTeamPlayerNames(registrations, team),
        seed: team.seed,
      },
    ])
  );
};

const matchTeam = (
  teamId: TeamId | null,
  refs: Map<TeamId, OverviewTeamRef>
): OverviewMatchTeam => {
  if (!teamId) return UNKNOWN_TEAM;
  return refs.get(teamId) ?? { ...UNKNOWN_TEAM, id: teamId, name: teamId };
};

const toOverviewMatch = (
  match: EliminationMatch,
  refs: Map<TeamId, OverviewTeamRef>
): OverviewBracketMatch => ({
  id: match.id,
  gameLabel: getGameLabel(match.id),
  round: match.round,
  index: match.index,
  status: match.status,
  reviewRequired: Boolean(match.reviewRequired),
  teamA: matchTeam(match.teamAId, refs),
  teamB: matchTeam(match.teamBId, refs),
  scoreA: match.scoreA,
  scoreB: match.scoreB,
  winnerId: getWinner(match),
  loserId: getLoser(match),
  winnerTo: linkLabel(match.winnerTo),
  loserTo: linkLabel(match.loserTo),
});

const winnersRoundLabel = (
  roundIndex: number,
  roundCount: number,
  bracketSize: number
): string => {
  if (roundIndex === roundCount - 1) return "Winners Final";
  const teamsAtRound =
    roundIndex < Math.floor(Math.log2(bracketSize))
      ? bracketSize / 2 ** roundIndex
      : null;
  if (teamsAtRound === 16) return "Round of 16";
  if (teamsAtRound === 8) return "Quarter-finals";
  if (teamsAtRound === 4) return "Semi-finals";
  return `Winners Round ${roundIndex + 1}`;
};

const losersRoundLabel = (roundIndex: number, roundCount: number): string =>
  roundIndex === roundCount - 1
    ? "Losers Final"
    : `Losers Round ${roundIndex + 1}`;

/**
 * Derives everything the visual overview needs from the existing selectors.
 * Ranking, qualification, seeding, progression and champions are never
 * recalculated here — only labels and the left/right presentation split.
 */
export const buildGsdeOverviewModel = (
  doc: GsdeTournamentDocument,
  viewerTeamId: TeamId | null = null
): GsdeOverviewModel => {
  const refs = buildTeamRefs(doc);
  const groupNameById = new Map(
    doc.groups.map((group) => [group.id, group.name])
  );
  const globalRankByTeam = new Map(
    selectGlobalRanking(doc).map((row) => [row.teamId, row.globalRank])
  );
  const finalResult = selectFinalResult(doc);
  const completion = selectCompletion(doc);
  const bracket = doc.elimination;
  const bracketSize = bracket?.bracketSize ?? bracket?.seededTeamIds?.length ?? 0;

  const entryByTeam = new Map<
    TeamId,
    { gameLabel: string; roundLabel: string }
  >();
  if (bracket) {
    const winnersBlocks = getWinnersBracketRounds(bracket);
    const losersBlocks = getLosersBracketRounds(bracket);
    for (const [roundIndex, block] of winnersBlocks.entries()) {
      const roundLabel = winnersRoundLabel(
        roundIndex,
        winnersBlocks.length,
        bracketSize
      );
      for (const match of block.matches) {
        for (const teamId of [match.teamAId, match.teamBId]) {
          if (teamId && !entryByTeam.has(teamId)) {
            entryByTeam.set(teamId, {
              gameLabel: getGameLabel(match.id),
              roundLabel,
            });
          }
        }
      }
    }
    for (const [roundIndex, block] of losersBlocks.entries()) {
      const roundLabel = losersRoundLabel(roundIndex, losersBlocks.length);
      for (const match of block.matches) {
        for (const teamId of [match.teamAId, match.teamBId]) {
          if (teamId && !entryByTeam.has(teamId)) {
            entryByTeam.set(teamId, {
              gameLabel: getGameLabel(match.id),
              roundLabel,
            });
          }
        }
      }
    }
  }

  const standings = [...selectGroupStandings(doc)].sort((a, b) =>
    compareText(
      groupNameById.get(a.groupId) ?? a.groupId,
      groupNameById.get(b.groupId) ?? b.groupId
    )
  );
  const groups = standings.map((table) => {
    const teams = table.rows.map((row) => {
      const ref = refs.get(row.teamId) ?? {
        id: row.teamId,
        name: row.teamId,
        players: [],
        seed: null,
      };
      const entry = entryByTeam.get(row.teamId) ?? null;
      return {
        ...ref,
        rank: row.rank,
        played: row.played,
        wins: row.wins,
        losses: row.losses,
        pointsFor: row.pointsFor,
        pointsAgainst: row.pointsAgainst,
        pointDifference: row.pointDifference,
        tiebreakUsed: row.tiebreakUsed,
        qualified: row.qualified,
        globalRank: globalRankByTeam.get(row.teamId) ?? null,
        entryGame: entry?.gameLabel ?? null,
        entryRound: entry?.roundLabel ?? null,
        isLeader: row.rank === 1,
        isViewerTeam: viewerTeamId === row.teamId,
      };
    });

    return {
      id: table.groupId,
      name: groupNameById.get(table.groupId) ?? table.groupId,
      teams,
      qualifiedCount: teams.filter((team) => team.qualified).length,
      totalCount: teams.length,
    };
  });

  const split = Math.ceil(groups.length / 2);

  const winnersRounds = bracket
    ? getWinnersBracketRounds(bracket).map((block, index, all) => ({
        round: block.round,
        label: winnersRoundLabel(index, all.length, bracketSize),
        matches: block.matches.map((match) => toOverviewMatch(match, refs)),
      }))
    : [];

  const losersRounds = bracket
    ? getLosersBracketRounds(bracket).map((block, index, all) => ({
        round: block.round,
        label: losersRoundLabel(index, all.length),
        matches: block.matches.map((match) => toOverviewMatch(match, refs)),
      }))
    : [];

  const grandFinal: OverviewGrandFinal = {
    matches: (bracket?.grandFinal ?? []).map((match) =>
      toOverviewMatch(match, refs)
    ),
    winnersChampionId: bracket ? getWinnersChampion(bracket) : null,
    losersChampionId: bracket ? getLosersChampion(bracket) : null,
    championTeamIds: finalResult.championTeamIds,
    runnerUpTeamIds: finalResult.runnerUpTeamIds,
    resetRequired: completion.resetRequired,
    resetWasPlayed: completion.resetWasPlayed,
    complete: finalResult.complete,
  };

  return {
    groups,
    leftGroups: groups.slice(0, split),
    rightGroups: groups.slice(split),
    winnersRounds,
    losersRounds,
    grandFinal,
    teamRefs: refs,
    bracketGenerated: Boolean(bracket),
    advanceAllTeams: Boolean(doc.tournament.config.advanceAllTeams),
    qualifiedCount: groups.reduce(
      (sum, group) => sum + group.qualifiedCount,
      0
    ),
    teamCount: doc.teams.length,
    progress: selectProgress(doc),
    completion,
  };
};

/** Uses the same registration rules as the player pages: approved membership only. */
export const resolveOverviewViewerTeamId = (
  doc: GsdeTournamentDocument,
  uid: string | null | undefined,
  email: string | null | undefined
): TeamId | null => {
  if (!uid) return null;
  const byUid = getRegisteredTeamId(doc, uid);
  if (byUid) return byUid;

  if (email) {
    const registration = findRegistrationByEmail(doc, email);
    if (registration) {
      return getRegisteredTeamId(doc, registration.uid);
    }
  }
  return null;
};
