import type {
  EliminationBracket,
  EliminationMatch,
  GroupStageMatch,
  MatchId,
  Team,
  TeamId,
  TournamentConfig,
} from "./types";
import type { GsdeTournamentDocument } from "./persistence";
import {
  applyGroupMatchScore,
  getGroupStageProgress,
  isGroupStageComplete,
  resetGroupMatchScore,
} from "./groupStageMatches";
import {
  calculateAllGroupStandings,
  seedTeamsFromGroupStandings,
  type GroupStandingsTable,
} from "./groupStandings";
import { buildFixed16GroupStage } from "./fixed16";
import {
  FIXED16_ADVANCE_OPTIONS,
  buildFixed16EliminationStage,
  canGenerateFixed16Bracket,
  getFixed16GlobalRanking,
  type GlobalRankingRow,
} from "./fixed16";
import {
  findEliminationMatch,
  generateDoubleEliminationBracket,
  listEliminationMatches,
} from "./bracket";
import {
  advanceEliminationMatch,
  getEliminationChampion,
  getEliminationLossCount,
  needsGrandFinalReset,
  type EliminationMatchOutcome,
} from "./progression";
import { applySpanishCrossover } from "./spanishCrossover";
import { getGameNumber } from "./gameNumbers";
import {
  calculateEliminationStandings,
  calculateFinalPlacements,
  type EliminationStanding,
  type FinalPlacement,
} from "./eliminationStandings";
import { EliminationError, GroupStageError } from "./errors";
import { validateTeamDraft } from "./teams";

/**
 * Admin scoring service for the new format.
 *
 * Every function is a pure transition: it takes the persisted tournament
 * document and returns the next one. Firestore writes happen in the calling
 * hook. This keeps score entry, validation, auto-advance and corrections
 * fully testable without a database.
 */

export type ScoringErrorCode =
  | "unknown-match"
  | "invalid-score"
  | "match-completed"
  | "bracket-locked"
  | "bracket-not-generated"
  | "group-stage-incomplete"
  | "not-enough-teams"
  | "invalid-team"
  | "stage-sequence"
  | "override-required";

export class ScoringError extends Error {
  readonly code: ScoringErrorCode;

  constructor(code: ScoringErrorCode, message: string) {
    super(message);
    this.name = "ScoringError";
    this.code = code;
  }
}

const fail = (code: ScoringErrorCode, message: string): never => {
  throw new ScoringError(code, message);
};

const touch = (doc: GsdeTournamentDocument): GsdeTournamentDocument => ({
  ...doc,
  tournament: {
    ...doc.tournament,
    updatedAt: new Date().toISOString(),
  },
});

const asEngineError = (error: unknown): ScoringErrorCode => {
  if (error instanceof GroupStageError) {
    return error.code === "invalid-score" ? "invalid-score" : "unknown-match";
  }
  if (error instanceof EliminationError) {
    if (error.code === "match-completed") return "match-completed";
    if (error.code === "invalid-outcome") return "invalid-score";
    if (error.code === "unknown-match") return "unknown-match";
    if (error.code === "group-stage-incomplete") {
      return "group-stage-incomplete";
    }
  }
  return "unknown-match";
};

/** Setup: update the tournament name/division without touching stage data. */
export const saveSetup = (
  doc: GsdeTournamentDocument,
  config: TournamentConfig
): GsdeTournamentDocument =>
  touch({
    ...doc,
    tournament: { ...doc.tournament, config },
  });

/**
 * Creates the fixed 16 teams and their 4 groups / 24 round-robin matches.
 * Rebuilding is only allowed before elimination starts.
 */
export const buildTeamsAndGroups = (
  doc: GsdeTournamentDocument,
  teams: readonly Team[]
): GsdeTournamentDocument => {
  if (doc.elimination && listEliminationMatches(doc.elimination).some((m) => m.status === "completed")) {
    fail("bracket-locked", "The elimination bracket has started; reset it before rebuilding teams.");
  }

  const pending = teams.filter((team) => team.status === "pending");
  if (pending.length > 0) {
    fail(
      "invalid-team",
      `${pending.length} team(s) are still pending approval. Approve them before generating groups.`
    );
  }

  const stage = buildFixed16GroupStage(teams);
  const withGroups = teams.map((team, index) => ({
    ...team,
    groupId: team.groupId ?? stage.groups.find((group) => group.teamIds.includes(team.id))?.id ?? `group-${Math.floor(index / 4) + 1}`,
  }));

  return touch({
    ...doc,
    teams: withGroups,
    groups: stage.groups,
    matches: stage.matches,
    elimination: null,
    tournament: {
      ...doc.tournament,
      status: "configured",
      seedingStale: false,
      config: {
        ...doc.tournament.config,
        groupCount: stage.groups.length,
        teamsPerGroup: 4,
      },
    },
  } as GsdeTournamentDocument);
};

export const startGroupStage = (
  doc: GsdeTournamentDocument
): GsdeTournamentDocument => {
  if (doc.matches.length !== 24) {
    fail("group-stage-incomplete", "Generate the group stage before starting it.");
  }
  return touch({
    ...doc,
    tournament: { ...doc.tournament, status: "group-stage" },
  });
};

const findGroupMatch = (
  doc: GsdeTournamentDocument,
  matchId: MatchId
): GroupStageMatch => {
  const match = doc.matches.find((item) => item.id === matchId);
  if (!match) fail("unknown-match", `No group match "${matchId}".`);
  return match;
};

/** Edit a registered team's name and/or seed (before groups are generated). */
export const editTeam = (
  doc: GsdeTournamentDocument,
  teamId: TeamId,
  patch: { name?: string; seed?: number | null }
): GsdeTournamentDocument => {
  const team = doc.teams.find((item) => item.id === teamId);
  if (!team) fail("invalid-team", `No team "${teamId}".`);
  if (doc.matches.length > 0) {
    fail("stage-sequence", "Teams cannot be edited after groups are generated.");
  }

  const draft = {
    name: patch.name ?? team.name,
    playerIds: team.playerIds,
    seed: patch.seed !== undefined ? patch.seed : team.seed,
  };
  const issues = validateTeamDraft(
    draft,
    doc.teams.filter((item) => item.id !== teamId)
  );
  if (issues.length > 0) {
    fail("invalid-team", issues.map((issue) => issue.message).join(" "));
  }

  return touch({
    ...doc,
    teams: doc.teams.map((item) => (item.id === teamId ? { ...item, ...draft } : item)),
  });
};

/** Approve or unapprove a registered team. */
export const approveTeam = (
  doc: GsdeTournamentDocument,
  teamId: TeamId,
  approved: boolean
): GsdeTournamentDocument => {
  if (!doc.teams.some((item) => item.id === teamId)) {
    fail("invalid-team", `No team "${teamId}".`);
  }
  return touch({
    ...doc,
    teams: doc.teams.map((item) =>
      item.id === teamId
        ? { ...item, status: approved ? ("approved" as const) : ("pending" as const) }
        : item
    ),
  });
};

/** Mark a group match as started (ready for score entry). */
export const startGroupMatch = (
  doc: GsdeTournamentDocument,
  matchId: MatchId
): GsdeTournamentDocument => {
  const match = findGroupMatch(doc, matchId);
  if (match.status === "completed") {
    fail("match-completed", `Group match "${matchId}" is already completed.`);
  }
  return touch({
    ...doc,
    matches: doc.matches.map((item) =>
      item.id === matchId ? { ...item, status: "ready" as const } : item
    ),
  });
};

/** Clear a group result so it can be replayed or corrected. */
export const resetGroupMatch = (
  doc: GsdeTournamentDocument,
  matchId: MatchId
): GsdeTournamentDocument => {
  const match = findGroupMatch(doc, matchId);
  return touch({
    ...doc,
    matches: doc.matches.map((item) =>
      item.id === matchId ? resetGroupMatchScore(item) : item
    ),
    tournament: { ...doc.tournament, status: "group-stage" },
  });
};

export interface GroupStageCompletion {
  isComplete: boolean;
  completed: number;
  total: number;
  /** Final group ranking 1–16, derived only from group results. */
  ranking: GlobalRankingRow[];
}

/** Verify completion and expose the final group ranking. */
export const verifyGroupStageCompletion = (
  doc: GsdeTournamentDocument
): GroupStageCompletion => {
  const progress = getGroupStageProgress(doc.matches);
  return {
    isComplete: progress.isComplete && progress.total === 24,
    completed: progress.completed,
    total: progress.total,
    ranking: getFixed16GlobalRanking(doc.groups, doc.matches),
  };
};

/** Explicit completion step; refuses to advance out of sequence. */
export const completeGroupStage = (
  doc: GsdeTournamentDocument
): GsdeTournamentDocument => {
  const check = verifyGroupStageCompletion(doc);
  if (!check.isComplete) {
    fail(
      "group-stage-incomplete",
      `Only ${check.completed}/${check.total} group matches are complete.`
    );
  }
  return touch({
    ...doc,
    tournament: { ...doc.tournament, groupStageVerified: true },
  } as GsdeTournamentDocument);
};

/** Submit a group score. Standings/ranking are derived on read. */
export const scoreGroupMatch = (
  doc: GsdeTournamentDocument,
  matchId: MatchId,
  scoreA: number,
  scoreB: number
): GsdeTournamentDocument => {
  const match = findGroupMatch(doc, matchId);
  if (match.status === "completed") {
    fail("match-completed", `Group match "${matchId}" is already completed.`);
  }

  try {
    const updated = applyGroupMatchScore(match, scoreA, scoreB);
    return touch({
      ...doc,
      matches: doc.matches.map((item) => (item.id === matchId ? updated : item)),
    });
  } catch (error) {
    fail(asEngineError(error), "Invalid group score.");
  }
};

/**
 * Correct a group score. When a bracket already exists but no elimination
 * result has been played, the bracket is reset so it can be regenerated from
 * the corrected ranking. Once results exist the bracket is locked.
 */
export const correctGroupMatchScore = (
  doc: GsdeTournamentDocument,
  matchId: MatchId,
  scoreA: number,
  scoreB: number
): GsdeTournamentDocument => {
  const match = findGroupMatch(doc, matchId);
  let updated: GroupStageMatch;

  try {
    updated = applyGroupMatchScore(match, scoreA, scoreB);
  } catch (error) {
    return fail(asEngineError(error), "Invalid group score.");
  }

  const bracket = doc.elimination;
  if (bracket && listEliminationMatches(bracket).some((m) => m.status === "completed")) {
    fail("bracket-locked", "Elimination results exist. Reset the bracket before correcting group scores.");
  }

  return touch({
    ...doc,
    matches: doc.matches.map((item) => (item.id === matchId ? updated : item)),
    elimination: null,
    tournament: {
      ...doc.tournament,
      status: "group-stage",
      seedingStale: bracket !== null,
    },
  });
};

export interface BracketGenerationOptions {
  /** Allow generating from partial group results. Requires `adminConfirmed`. */
  overrideIncomplete?: boolean;
  /** Explicit admin acknowledgement that the bracket is provisional. */
  adminConfirmed?: boolean;
}

/**
 * All 24 group matches gate bracket generation. An admin override is only
 * honoured when BOTH `overrideIncomplete` and `adminConfirmed` are set; the
 * resulting bracket is flagged `seedingStale` so it must be regenerated once
 * the group stage is genuinely complete.
 */
export const generateEliminationBracket = (
  doc: GsdeTournamentDocument,
  options: BracketGenerationOptions = {}
): GsdeTournamentDocument => {
  if (!canGenerateFixed16Bracket(doc.matches)) {
    if (!options.overrideIncomplete || !options.adminConfirmed) {
      fail(
        "group-stage-incomplete",
        "All 24 group matches must be complete. An admin override requires explicit confirmation."
      );
    }

    const seeds = seedTeamsFromGroupStandings(
      calculateAllGroupStandings(doc.groups, doc.matches)
    );
    const bracket = applySpanishCrossover(
      generateDoubleEliminationBracket(seeds).bracket
    );

    return touch({
      ...doc,
      elimination: bracket,
      tournament: {
        ...doc.tournament,
        status: "elimination",
        seedingStale: true,
        bracketOverrideUsed: true,
        groupStageVerified: false,
      },
    });
  }

  const stage = buildFixed16EliminationStage({
    groups: doc.groups,
    matches: doc.matches,
    rounds: [],
  });

  return touch({
    ...doc,
    elimination: stage.bracket,
    tournament: {
      ...doc.tournament,
      status: "elimination",
      seedingStale: false,
      bracketOverrideUsed: false,
      groupStageVerified: true,
    },
  });
};

/** Drops an unstarted bracket so group scores can be corrected/regenerated. */
export const resetEliminationBracket = (
  doc: GsdeTournamentDocument
): GsdeTournamentDocument => {
  if (
    doc.elimination &&
    listEliminationMatches(doc.elimination).some((m) => m.status === "completed")
  ) {
    fail("bracket-locked", "Completed elimination results cannot be discarded automatically.");
  }

  return touch({
    ...doc,
    elimination: null,
    tournament: {
      ...doc.tournament,
      status: doc.matches.every((m) => m.status === "completed") ? "configured" : "group-stage",
      seedingStale: false,
    },
  } as GsdeTournamentDocument);
};

const statusFromBracket = (bracket: EliminationBracket): GsdeTournamentDocument["tournament"]["status"] => {
  if (getEliminationChampion(bracket)) return "completed";
  const grandFinal = bracket.grandFinal.find((match) => match.round === 1);
  if (grandFinal?.status === "ready" || grandFinal?.status === "completed") {
    return "grand-final";
  }
  return "elimination";
};

const findEliminationMatchOrFail = (
  bracket: EliminationBracket,
  matchId: MatchId
): EliminationMatch => {
  const match = findEliminationMatch(bracket, matchId);
  if (!match) fail("unknown-match", `No elimination match "${matchId}".`);
  return match;
};

/** Submit an elimination score; winner advances and loser drops automatically. */
export const scoreEliminationMatch = (
  doc: GsdeTournamentDocument,
  outcome: EliminationMatchOutcome
): GsdeTournamentDocument => {
  if (!doc.elimination) {
    fail("bracket-not-generated", "Generate the elimination bracket first.");
  }

  findEliminationMatchOrFail(doc.elimination, outcome.matchId);
  try {
    const result = advanceEliminationMatch(
      doc.elimination,
      outcome,
      FIXED16_ADVANCE_OPTIONS
    );
    return touch({
      ...doc,
      elimination: result.bracket,
      tournament: {
        ...doc.tournament,
        status: statusFromBracket(result.bracket),
      },
    });
  } catch (error) {
    return fail(asEngineError(error), "Invalid elimination result.");
  }
};

interface StoredResult {
  matchId: MatchId;
  winnerId: TeamId;
  loserId: TeamId;
  scoreA: number | null;
  scoreB: number | null;
}

const collectResults = (bracket: EliminationBracket): StoredResult[] =>
  listEliminationMatches(bracket)
    .filter(
      (match): match is EliminationMatch =>
        match.status === "completed" &&
        match.winnerId !== null &&
        match.loserId !== null
    )
    .map((match) => ({
      matchId: match.id,
      winnerId: match.winnerId as TeamId,
      loserId: match.loserId as TeamId,
      scoreA: match.scoreA,
      scoreB: match.scoreB,
    }));

/**
 * Rebuilds the bracket from the generated state and replays every stored
 * result in game order. Results that no longer apply after a correction are
 * dropped, so the bracket is always internally consistent.
 */
const replayResults = (
  seededTeamIds: readonly TeamId[],
  results: readonly StoredResult[]
): EliminationBracket => {
  let bracket = applySpanishCrossover(
    generateDoubleEliminationBracket(seededTeamIds).bracket
  );

  const ordered = [...results].sort((a, b) => {
    const gameA = getGameNumber(a.matchId) ?? 999;
    const gameB = getGameNumber(b.matchId) ?? 999;
    return gameA - gameB || a.matchId.localeCompare(b.matchId);
  });

  for (const result of ordered) {
    try {
      bracket = advanceEliminationMatch(
        bracket,
        {
          matchId: result.matchId,
          winnerId: result.winnerId,
          loserId: result.loserId,
          scoreA: result.scoreA,
          scoreB: result.scoreB,
        },
        FIXED16_ADVANCE_OPTIONS
      ).bracket;
    } catch {
      // A stale downstream result (participants changed) is dropped.
    }
  }

  return bracket;
};

/** Correct one elimination result and recalculate the whole bracket. */
export const correctEliminationResult = (
  doc: GsdeTournamentDocument,
  matchId: MatchId,
  outcome: Omit<StoredResult, "matchId">
): GsdeTournamentDocument => {
  if (!doc.elimination) {
    fail("bracket-not-generated", "Generate the elimination bracket first.");
  }

  const seeds =
    doc.elimination.seededTeamIds ??
    seedTeamsFromGroupStandings(
      calculateAllGroupStandings(doc.groups, doc.matches)
    );
  const results = collectResults(doc.elimination).filter(
    (result) => result.matchId !== matchId
  );
  results.push({ matchId, ...outcome });

  const bracket = replayResults(seeds, results);
  return touch({
    ...doc,
    elimination: bracket,
    tournament: {
      ...doc.tournament,
      status: statusFromBracket(bracket),
    },
  });
};

/** Selectors used by the public UI and admin screens. */

export const selectGroupStandings = (
  doc: GsdeTournamentDocument
): GroupStandingsTable[] => calculateAllGroupStandings(doc.groups, doc.matches);

export const selectGlobalRanking = (
  doc: GsdeTournamentDocument
): GlobalRankingRow[] => getFixed16GlobalRanking(doc.groups, doc.matches);

export const selectEliminationStandings = (
  doc: GsdeTournamentDocument
): EliminationStanding[] =>
  doc.elimination ? calculateEliminationStandings(doc.elimination) : [];

export const selectPlacements = (
  doc: GsdeTournamentDocument
): FinalPlacement[] =>
  doc.elimination ? calculateFinalPlacements(doc.elimination) : [];

export const selectProgress = (doc: GsdeTournamentDocument) => ({
  groups: getGroupStageProgress(doc.matches),
  eliminationComplete: doc.elimination
    ? listEliminationMatches(doc.elimination).filter((m) => m.status === "completed").length
    : 0,
  resetRequired: doc.elimination ? needsGrandFinalReset(doc.elimination) : false,
  champion: doc.elimination ? getEliminationChampion(doc.elimination) : null,
});

export const selectLossCount = (
  doc: GsdeTournamentDocument,
  teamId: TeamId
): number =>
  doc.elimination ? getEliminationLossCount(doc.elimination, teamId) : 0;

/** Champion, runner-up and final positions for the completion panel. */
export const selectFinalResult = (doc: GsdeTournamentDocument) => {
  const placements = selectPlacements(doc);
  const first = placements.find((placement) => placement.place === 1);
  const second = placements.find((placement) => placement.place === 2);
  return {
    complete: Boolean(doc.elimination && getEliminationChampion(doc.elimination)),
    championTeamIds: first?.teamIds ?? [],
    runnerUpTeamIds: second?.teamIds ?? [],
    placements,
  };
};

/** Count of approved teams, used to gate group generation. */
export const selectApprovedTeamCount = (
  doc: GsdeTournamentDocument
): number => doc.teams.filter((team) => team.status !== "pending").length;
