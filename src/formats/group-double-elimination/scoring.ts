import type {
  EliminationBracket,
  EliminationMatch,
  GroupStageMatch,
  MatchId,
  PlayerRegistration,
  Team,
  TeamId,
  TournamentConfig,
} from "./types";
import type { GsdeTournamentDocument } from "./persistence";
import {
  applyGroupMatchScore,
  getGroupStageProgress,
  resetGroupMatchScore,
} from "./groupStageMatches";
import {
  calculateAllGroupStandings,
  seedTeamsFromGroupStandings,
  type GroupStandingsTable,
} from "./groupStandings";
import { FIXED16_ADVANCE_OPTIONS, type GlobalRankingRow } from "./fixed16";
import {
  buildOverrideBracket,
  buildSizeAwareEliminationStage,
  buildSizeAwareGroupStage,
  canGenerateSizeAwareBracket,
  expectedGroupMatchCount,
  getSizeAwareGlobalRanking,
} from "./sizeAware";
import {
  normalizeTournamentCategory,
  refreshPairTeamNames,
} from "./category";
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
import {
  findRegistrationByEmail,
  findRegistrationByUid,
  getRegistrations,
  normalizeRegistrationEmail,
  validateRegistrationDraft,
  type RegistrationDraft,
} from "./registration";
import {
  appendAudit,
  type AuditAction,
  type AuditActor,
} from "./audit";
import { assertTournamentIntegrity, IntegrityError } from "./integrity";
import {
  assertNotPastStage,
  assertStageAdvance,
  LifecycleError,
  reopenTournament as reopenTournamentCore,
  type ReopenOptions,
} from "./lifecycle";

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
  | "override-required"
  | "integrity-violation"
  | "unauthorized"
  | "not-completed"
  | "confirm-discard"
  | "registration-closed"
  | "registration-invalid"
  | "already-registered"
  | "registration-not-found";

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
  if (error instanceof LifecycleError) return error.code;
  return "unknown-match";
};

interface AuditCall {
  action: AuditAction;
  actor?: AuditActor;
  matchId?: MatchId;
  teamId?: TeamId;
  detail?: string;
}

/**
 * Single persistence gate: audit first, then verify integrity. No transition
 * can write a document whose ids, participants or progression are broken.
 */
/** Convert lifecycle guard failures into the service's error type. */
const guard = <T>(action: () => T): T => {
  try {
    return action();
  } catch (error) {
    if (error instanceof LifecycleError) fail(error.code, error.message);
    throw error;
  }
};

const commit = (
  doc: GsdeTournamentDocument,
  audit?: AuditCall
): GsdeTournamentDocument => {
  const next = audit ? appendAudit(doc, audit) : doc;
  try {
    assertTournamentIntegrity(next);
  } catch (error) {
    if (error instanceof IntegrityError) {
      fail("integrity-violation", error.message);
    }
    throw error;
  }
  return next;
};

/** Setup: update the tournament name/division without touching stage data. */
export const saveSetup = (
  doc: GsdeTournamentDocument,
  config: TournamentConfig,
  actor?: AuditActor
): GsdeTournamentDocument => {
  if (doc.tournament.status === "completed") {
    fail("stage-sequence", "Reopen the tournament before changing its setup.");
  }
  return commit(
    touch({
      ...doc,
      tournament: {
        ...doc.tournament,
        config: { ...config, category: normalizeTournamentCategory(config.category) },
      },
    }),
    { action: "setup-saved", actor }
  );
};

/**
 * Destructive full reset: clear every stage, roster and registration while
 * keeping the event id, setup, settings and audit history. Allowed at any
 * stage, including completed, because it is the only way to reuse an event id
 * for a fresh tournament. The caller is responsible for the explicit
 * confirmation checkbox in the admin UI.
 */
export const resetTournament = (
  doc: GsdeTournamentDocument,
  actor?: AuditActor
): GsdeTournamentDocument => {
  const now = new Date().toISOString();
  const cleared = {
    teams: doc.teams.length,
    groups: doc.groups.length,
    matches: doc.matches.length,
    registrations: (doc.registrations ?? []).length,
  };

  return commit(
    {
      id: doc.id,
      tournament: {
        config: {
          ...doc.tournament.config,
          category: normalizeTournamentCategory(doc.tournament.config.category),
        },
        status: "draft",
        seedingStale: false,
        bracketOverrideUsed: false,
        groupStageVerified: false,
        createdAt: doc.tournament.createdAt ?? now,
        updatedAt: now,
      },
      teams: [],
      groups: [],
      matches: [],
      elimination: null,
      auditLog: doc.auditLog ?? [],
      registrations: [],
      scoreSubmissions: {},
      settings: doc.settings,
    },
    {
      action: "tournament-reset",
      actor,
      detail: `Cleared ${cleared.teams} teams, ${cleared.groups} groups, ${cleared.matches} matches and ${cleared.registrations} registrations.`,
    }
  );
};

/** Register one team; audit identity is supplied by the admin caller. */
export const addTeam = (
  doc: GsdeTournamentDocument,
  team: Team,
  actor?: AuditActor
): GsdeTournamentDocument => {
  guard(() => assertNotPastStage(doc, "configured"));
  if (doc.teams.some((item) => item.id === team.id)) {
    fail("invalid-team", `Team "${team.id}" already exists.`);
  }
  return commit(
    touch({ ...doc, teams: [...doc.teams, team] }),
    { action: "team-added", actor, teamId: team.id }
  );
};

/**
 * Registration and its admin decisions are locked once the group stage starts.
 * Translate the generic lifecycle guard into a registration-specific error so
 * callers can show an accurate "registration closed" message.
 */
const guardRegistrationOpen = (doc: GsdeTournamentDocument): void => {
  try {
    assertNotPastStage(doc, "configured");
  } catch (error) {
    if (error instanceof LifecycleError && error.code === "stage-sequence") {
      fail("registration-closed", "Player registration is closed for this tournament.");
    }
    throw error;
  }
};

/** Remove a player id from every team roster (used on reject/removal/reassign). */
const detachPlayerFromTeams = (
  doc: GsdeTournamentDocument,
  uid: string
): Team[] =>
  doc.teams.map((team) => ({
    ...team,
    playerIds: team.playerIds.filter((id) => id !== uid),
  }));

/** Recompute default pair names after any roster change. */
const withRefreshedPairNames = (
  doc: GsdeTournamentDocument
): GsdeTournamentDocument => ({ ...doc, teams: refreshPairTeamNames(doc) });

/**
 * Self-service registration for an individual player. Registration closes as
 * soon as the group stage starts. The signing-in player is the audit actor, so
 * the sign-up is attributable without granting them admin rights.
 */
export const registerPlayer = (
  doc: GsdeTournamentDocument,
  draft: RegistrationDraft,
  actor?: AuditActor
): GsdeTournamentDocument => {
  guardRegistrationOpen(doc);
  const issues = validateRegistrationDraft(draft);
  if (issues.length > 0) fail("registration-invalid", issues[0].message);

  const email = normalizeRegistrationEmail(draft.email);
  if (findRegistrationByUid(doc, draft.uid) || findRegistrationByEmail(doc, email)) {
    fail("already-registered", "This account or email is already registered.");
  }

  const now = new Date().toISOString();
  const registration: PlayerRegistration = {
    uid: draft.uid,
    email,
    name: draft.name.trim(),
    gender: draft.gender,
    status: "pending",
    teamId: null,
    registeredAt: now,
    decidedAt: null,
  };
  return commit(
    touch({ ...doc, registrations: [...getRegistrations(doc), registration] }),
    {
      action: "player-registered",
      actor: actor ?? { id: draft.uid, label: email, isAdmin: false },
      detail: `${registration.name} registered as a player.`,
    }
  );
};

const requireRegistration = (
  doc: GsdeTournamentDocument,
  uid: string
): PlayerRegistration => {
  const registration = findRegistrationByUid(doc, uid);
  if (!registration) {
    fail("registration-not-found", `No registration for account "${uid}".`);
  }
  return registration;
};

/** Admin approves a pending player and assigns them to a team. */
export const approvePlayerRegistration = (
  doc: GsdeTournamentDocument,
  uid: string,
  teamId: TeamId,
  actor?: AuditActor
): GsdeTournamentDocument => {
  guardRegistrationOpen(doc);
  const registration = requireRegistration(doc, uid);
  if (registration.gender !== "male" && registration.gender !== "female") {
    fail("registration-invalid", "This registration is missing a player gender.");
  }
  // Re-approving an already-approved player is a valid, audited reassignment.
  const target = doc.teams.find((team) => team.id === teamId);
  if (!target) {
    fail("invalid-team", `No team "${teamId}".`);
  }
  if (!target.playerIds.includes(uid) && target.playerIds.length >= 2) {
    fail("invalid-team", "Teams are fixed pairs of exactly two players.");
  }

  const now = new Date().toISOString();
  const registrations = getRegistrations(doc).map((item) =>
    item.uid === uid
      ? { ...item, status: "approved" as const, teamId, decidedAt: now }
      : item
  );
  const teams = detachPlayerFromTeams(doc, uid).map((team) =>
    team.id === teamId && !team.playerIds.includes(uid)
      ? { ...team, playerIds: [...team.playerIds, uid] }
      : team
  );
  return commit(
    touch(withRefreshedPairNames({ ...doc, registrations, teams })),
    {
      action: "player-registration-approved",
      actor,
      teamId,
      detail: `${registration.name} approved and assigned to a team.`,
    }
  );
};

/** Admin rejects a registration; any team assignment is cleared. */
export const rejectPlayerRegistration = (
  doc: GsdeTournamentDocument,
  uid: string,
  actor?: AuditActor
): GsdeTournamentDocument => {
  guardRegistrationOpen(doc);
  const registration = requireRegistration(doc, uid);
  const now = new Date().toISOString();
  const registrations = getRegistrations(doc).map((item) =>
    item.uid === uid
      ? { ...item, status: "rejected" as const, teamId: null, decidedAt: now }
      : item
  );
  return commit(
    touch(withRefreshedPairNames({ ...doc, registrations, teams: detachPlayerFromTeams(doc, uid) })),
    {
      action: "player-registration-rejected",
      actor,
      detail: `${registration.name}'s registration was rejected.`,
    }
  );
};

/** Admin removes a registration entirely; any team assignment is cleared. */
export const removePlayerRegistration = (
  doc: GsdeTournamentDocument,
  uid: string,
  actor?: AuditActor
): GsdeTournamentDocument => {
  guardRegistrationOpen(doc);
  const registration = requireRegistration(doc, uid);
  const registrations = getRegistrations(doc).filter((item) => item.uid !== uid);
  return commit(
    touch(withRefreshedPairNames({ ...doc, registrations, teams: detachPlayerFromTeams(doc, uid) })),
    {
      action: "player-registration-removed",
      actor,
      detail: `${registration.name}'s registration was removed.`,
    }
  );
};

/** Remove a registered team before group generation. */
export const removeTeam = (
  doc: GsdeTournamentDocument,
  teamId: TeamId,
  actor?: AuditActor
): GsdeTournamentDocument => {
  guard(() => assertNotPastStage(doc, "configured"));
  if (!doc.teams.some((item) => item.id === teamId)) {
    fail("invalid-team", `No team "${teamId}".`);
  }
  return commit(
    touch({ ...doc, teams: doc.teams.filter((item) => item.id !== teamId) }),
    { action: "team-removed", actor, teamId }
  );
};

/**
 * Creates the approved teams' groups and round-robin matches. The 16-team path
 * keeps the fixed 4-group / 24-match engine; other supported sizes use the same
 * generic group engine with four teams per group. Rebuilding is only allowed
 * before elimination starts.
 */
export const buildTeamsAndGroups = (
  doc: GsdeTournamentDocument,
  teams: readonly Team[],
  actor?: AuditActor
): GsdeTournamentDocument => {
  guard(() => assertNotPastStage(doc, "configured"));
  if (doc.elimination && listEliminationMatches(doc.elimination).some((m) => m.status === "completed")) {
    fail("bracket-locked", "The elimination bracket has started; reset it before rebuilding teams.");
  }

  const expectedTeams = doc.tournament.config.teamLimit;
  if (Number.isInteger(expectedTeams) && teams.length !== expectedTeams) {
    fail(
      "invalid-team",
      `This tournament is configured for ${expectedTeams} teams, but ${teams.length} were supplied.`
    );
  }

  const pending = teams.filter((team) => team.status === "pending");
  if (pending.length > 0) {
    fail(
      "invalid-team",
      `${pending.length} team(s) are still pending approval. Approve them before generating groups.`
    );
  }

  const stage = buildSizeAwareGroupStage(doc, teams);
  const teamsPerGroup = stage.groups[0]?.teamIds.length ?? 4;
  const withGroups = teams.map((team, index) => ({
    ...team,
    groupId: team.groupId ?? stage.groups.find((group) => group.teamIds.includes(team.id))?.id ?? `group-${Math.floor(index / teamsPerGroup) + 1}`,
  }));

  return commit(
    touch({
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
          teamLimit: teams.length,
          groupCount: stage.groups.length,
          teamsPerGroup,
        },
      },
    } as GsdeTournamentDocument),
    { action: "groups-generated", actor }
  );
};

export const startGroupStage = (
  doc: GsdeTournamentDocument,
  actor?: AuditActor
): GsdeTournamentDocument => {
  guard(() => assertStageAdvance(doc, "group-stage"));
  const expected = expectedGroupMatchCount(doc);
  if (doc.matches.length !== expected || doc.matches.length === 0) {
    fail("group-stage-incomplete", "Generate the group stage before starting it.");
  }
  return commit(
    touch({
      ...doc,
      tournament: { ...doc.tournament, status: "group-stage" },
    }),
    { action: "group-match-started", actor, detail: "Group stage started." }
  );
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
  patch: { name?: string; seed?: number | null },
  actor?: AuditActor
): GsdeTournamentDocument => {
  guard(() => assertNotPastStage(doc, "configured"));
  const team = doc.teams.find((item) => item.id === teamId);
  if (!team) fail("invalid-team", `No team "${teamId}".`);
  if (doc.matches.length > 0) {
    fail("stage-sequence", "Teams cannot be edited after groups are generated.");
  }

  const nameIsCustom = Boolean(team.nameIsCustom) || patch.name !== undefined;
  const draft = {
    name: patch.name ?? team.name,
    playerIds: team.playerIds,
    seed: patch.seed !== undefined ? patch.seed : team.seed,
    nameIsCustom,
  };
  const issues = validateTeamDraft(
    draft,
    doc.teams.filter((item) => item.id !== teamId)
  );
  if (issues.length > 0) {
    fail("invalid-team", issues.map((issue) => issue.message).join(" "));
  }

  return commit(
    touch({
      ...doc,
      teams: doc.teams.map((item) => (item.id === teamId ? { ...item, ...draft } : item)),
    }),
    { action: "team-edited", actor, teamId }
  );
};

/** Approve or unapprove a registered team. */
export const approveTeam = (
  doc: GsdeTournamentDocument,
  teamId: TeamId,
  approved: boolean,
  actor?: AuditActor
): GsdeTournamentDocument => {
  guard(() => assertNotPastStage(doc, "configured"));
  if (!doc.teams.some((item) => item.id === teamId)) {
    fail("invalid-team", `No team "${teamId}".`);
  }
  return commit(
    touch({
      ...doc,
      teams: doc.teams.map((item) =>
        item.id === teamId
          ? { ...item, status: approved ? ("approved" as const) : ("pending" as const) }
          : item
      ),
    }),
    { action: "team-approved", actor, teamId, detail: approved ? "Approved" : "Unapproved" }
  );
};

/** Mark a group match as started (ready for score entry). */
export const startGroupMatch = (
  doc: GsdeTournamentDocument,
  matchId: MatchId,
  actor?: AuditActor
): GsdeTournamentDocument => {
  guard(() => assertNotPastStage(doc, "group-stage"));
  const match = findGroupMatch(doc, matchId);
  if (match.status === "completed") {
    fail("match-completed", `Group match "${matchId}" is already completed.`);
  }
  return commit(
    touch({
      ...doc,
      matches: doc.matches.map((item) =>
        item.id === matchId ? { ...item, status: "ready" as const } : item
      ),
    }),
    { action: "group-match-started", actor, matchId }
  );
};

/** Clear a group result so it can be replayed or corrected. */
export const resetGroupMatch = (
  doc: GsdeTournamentDocument,
  matchId: MatchId,
  actor?: AuditActor
): GsdeTournamentDocument => {
  guard(() => assertNotPastStage(doc, "group-stage"));
  const match = findGroupMatch(doc, matchId);
  return commit(
    touch({
      ...doc,
      matches: doc.matches.map((item) =>
        item.id === matchId ? resetGroupMatchScore(item) : item
      ),
      tournament: { ...doc.tournament, status: "group-stage" },
    }),
    { action: "group-match-reset", actor, matchId }
  );
};

export interface GroupStageCompletion {
  isComplete: boolean;
  completed: number;
  total: number;
  /** Final group ranking, derived only from group results. */
  ranking: GlobalRankingRow[];
}

/** Verify completion and expose the final group ranking. */
export const verifyGroupStageCompletion = (
  doc: GsdeTournamentDocument
): GroupStageCompletion => {
  const progress = getGroupStageProgress(doc.matches);
  return {
    isComplete:
      progress.isComplete &&
      progress.total === expectedGroupMatchCount(doc) &&
      progress.total > 0,
    completed: progress.completed,
    total: progress.total,
    ranking: getSizeAwareGlobalRanking(doc),
  };
};

/** Explicit completion step; refuses to advance out of sequence. */
export const completeGroupStage = (
  doc: GsdeTournamentDocument,
  actor?: AuditActor
): GsdeTournamentDocument => {
  guard(() => assertNotPastStage(doc, "group-stage"));
  const check = verifyGroupStageCompletion(doc);
  if (!check.isComplete) {
    fail(
      "group-stage-incomplete",
      `Only ${check.completed}/${check.total} group matches are complete.`
    );
  }
  return commit(
    touch({
      ...doc,
      tournament: { ...doc.tournament, groupStageVerified: true },
    } as GsdeTournamentDocument),
    { action: "group-stage-completed", actor }
  );
};

/** Submit a group score. Standings/ranking are derived on read. */
export const scoreGroupMatch = (
  doc: GsdeTournamentDocument,
  matchId: MatchId,
  scoreA: number,
  scoreB: number,
  actor?: AuditActor
): GsdeTournamentDocument => {
  guard(() => assertNotPastStage(doc, "group-stage"));
  const match = findGroupMatch(doc, matchId);
  if (match.status === "completed") {
    fail("match-completed", `Group match "${matchId}" is already completed.`);
  }

  try {
    const updated = applyGroupMatchScore(match, scoreA, scoreB);
    return commit(
      touch({
        ...doc,
        matches: doc.matches.map((item) => (item.id === matchId ? updated : item)),
      }),
      { action: "group-score-entered", actor, matchId }
    );
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
  scoreB: number,
  actor?: AuditActor
): GsdeTournamentDocument => {
  if (doc.tournament.status === "completed") {
    fail("stage-sequence", "Reopen the tournament before correcting results.");
  }
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

  return commit(
    touch({
      ...doc,
      matches: doc.matches.map((item) => (item.id === matchId ? updated : item)),
      elimination: null,
      tournament: {
        ...doc.tournament,
        status: "group-stage",
        seedingStale: bracket !== null,
        groupStageVerified: false,
      },
    }),
    {
      action: "group-score-corrected",
      actor,
      matchId,
      detail: `${match.scoreA ?? "–"}:${match.scoreB ?? "–"} → ${scoreA}:${scoreB}`,
    }
  );
};

export interface BracketGenerationOptions {
  /** Allow generating from partial group results. Requires `adminConfirmed`. */
  overrideIncomplete?: boolean;
  /** Explicit admin acknowledgement that the bracket is provisional. */
  adminConfirmed?: boolean;
}

/**
 * Every group match gates bracket generation. An admin override is only
 * honoured when BOTH `overrideIncomplete` and `adminConfirmed` are set; the
 * resulting bracket is flagged `seedingStale` so it must be regenerated once
 * the group stage is genuinely complete.
 */
export const generateEliminationBracket = (
  doc: GsdeTournamentDocument,
  options: BracketGenerationOptions = {},
  actor?: AuditActor
): GsdeTournamentDocument => {
  if (
    doc.elimination &&
    listEliminationMatches(doc.elimination).some((match) => match.status === "completed")
  ) {
    fail("bracket-locked", "The elimination bracket has results; reset it before regenerating.");
  }
  if (!canGenerateSizeAwareBracket(doc)) {
    if (!options.overrideIncomplete || !options.adminConfirmed) {
      fail(
        "group-stage-incomplete",
        `All ${expectedGroupMatchCount(doc)} group matches must be complete. An admin override requires explicit confirmation.`
      );
    }

    const bracket = buildOverrideBracket(doc);

    return commit(
      touch({
        ...doc,
        elimination: bracket,
        tournament: {
          ...doc.tournament,
          status: "elimination",
          seedingStale: true,
          bracketOverrideUsed: true,
          groupStageVerified: false,
        },
      }),
      {
        action: "bracket-override-generated",
        actor,
        detail: "Provisional bracket from incomplete group standings.",
      }
    );
  }

  const stage = buildSizeAwareEliminationStage(doc);

  return commit(
    touch({
      ...doc,
      elimination: stage.bracket,
      tournament: {
        ...doc.tournament,
        status: "elimination",
        seedingStale: false,
        bracketOverrideUsed: false,
        groupStageVerified: true,
      },
    }),
    { action: "bracket-generated", actor }
  );
};

/** Drops an unstarted bracket so group scores can be corrected/regenerated. */
export const resetEliminationBracket = (
  doc: GsdeTournamentDocument,
  actor?: AuditActor
): GsdeTournamentDocument => {
  if (
    doc.elimination &&
    listEliminationMatches(doc.elimination).some((m) => m.status === "completed")
  ) {
    fail("bracket-locked", "Completed elimination results cannot be discarded automatically.");
  }

  return commit(
    touch({
      ...doc,
      elimination: null,
      tournament: {
        ...doc.tournament,
        status: doc.matches.every((m) => m.status === "completed") ? "configured" : "group-stage",
        seedingStale: false,
        groupStageVerified: false,
      },
    } as GsdeTournamentDocument),
    { action: "bracket-reset", actor }
  );
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
  outcome: EliminationMatchOutcome,
  actor?: AuditActor
): GsdeTournamentDocument => {
  if (doc.tournament.status === "completed") {
    fail("stage-sequence", "Reopen the tournament before changing a result.");
  }
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
    return commit(
      touch({
        ...doc,
        elimination: result.bracket,
        tournament: {
          ...doc.tournament,
          status: statusFromBracket(result.bracket),
        },
      }),
      { action: "elimination-score-entered", actor, matchId: outcome.matchId }
    );
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
  outcome: Omit<StoredResult, "matchId">,
  actor?: AuditActor
): GsdeTournamentDocument => {
  if (doc.tournament.status === "completed") {
    fail("stage-sequence", "Reopen the tournament before correcting a result.");
  }
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
  return commit(
    touch({
      ...doc,
      elimination: bracket,
      tournament: {
        ...doc.tournament,
        status: statusFromBracket(bracket),
      },
    }),
    { action: "elimination-result-corrected", actor, matchId }
  );
};

/** Authorized reopen of a completed tournament, with integrity validation. */
export const reopenTournament = (
  doc: GsdeTournamentDocument,
  actor: AuditActor,
  options: ReopenOptions
): GsdeTournamentDocument =>
  guard(() => commit(reopenTournamentCore(doc, actor, options)));

/** Selectors used by the public UI and admin screens. */

export const selectGroupStandings = (
  doc: GsdeTournamentDocument
): GroupStandingsTable[] => calculateAllGroupStandings(doc.groups, doc.matches);

export const selectGlobalRanking = (
  doc: GsdeTournamentDocument
): GlobalRankingRow[] => getSizeAwareGlobalRanking(doc);

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
