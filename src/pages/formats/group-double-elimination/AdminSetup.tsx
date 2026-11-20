import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileText,
  Loader2,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Trash2,
  Trophy,
  Zap,
} from "lucide-react";
import {
  createPendingTeam,
  createTeamId,
  getGameLabel,
  getGameNumber,
  getWinner,
  validateTeamDraft,
  type EliminationMatch,
  type TournamentCategory,
} from "@/formats/group-double-elimination";
import {
  DEFAULT_SCORE_RULE,
  validateScore,
} from "@/formats/group-double-elimination/scoreRules";
import { findWinnerScoreConflicts } from "@/formats/group-double-elimination/integrity";
import {
  addTeam as addGsdeTeam,
  approvePlayerRegistration,
  approveTeam,
  buildTeamsAndGroups,
  completeGroupStage,
  correctEliminationResult,
  correctGroupMatchScore,
  editPlayerRegistration,
  editTeam,
  generateEliminationBracket,
  rejectPlayerRegistration,
  removePlayerRegistration,
  reopenTournament,
  removeTeam,
  resetEliminationBracket,
  resetGroupMatch,
  recomputeBracketFromResults,
  resetTournament,
  saveSetup,
  scoreEliminationMatch,
  scoreGroupMatch,
  selectApprovedTeamCount,
  selectCompletion,
  selectEliminationStandings,
  selectFinalResult,
  selectGlobalRanking,
  selectGroupStandings,
  selectPlacements,
  startGroupMatch,
  startGroupStage,
  verifyGroupStageCompletion,
} from "@/formats/group-double-elimination/scoring";
import {
  getRegisteredTeamId,
  getRegistrations,
  getRegistrationStats,
} from "@/formats/group-double-elimination/registration";
import {
  adminChangePairing,
  adminCreatePairTeam,
  adminRemovePairing,
  getPairingInvitations,
  getPairingStatusForPlayer,
  isPairingLocked,
  selectUnpairedPlayers,
} from "@/formats/group-double-elimination/pairing";
import type {
  PairingInvitation,
  PlayerGender,
} from "@/formats/group-double-elimination/types";
import {
  UNKNOWN_ADMIN,
  selectCorrections,
  type AuditActor,
} from "@/formats/group-double-elimination/audit";
import { findSubmissionForMatch } from "@/formats/group-double-elimination/playerSubmission";
import {
  canLoadDemoTestData,
  GROUP_COUNT_BY_TEAM_COUNT,
  ensureDemoPlayerTestData,
  SUPPORTED_TEST_TEAM_COUNTS,
  TEST_RESULT_MODE_OPTIONS,
  type TestResultMode,
  type TestTeamCount,
} from "@/formats/group-double-elimination/testData";
import {
  getTeamPlayerNames,
  normalizeTournamentCategory,
  TOURNAMENT_CATEGORY_OPTIONS,
} from "@/formats/group-double-elimination/category";
import { getCurrentUser } from "@/utils/authUtils";
import { ensureDemoPlayerAuth } from "@/utils/demoPlayerAuth";
import { exportGsdeTournamentPdf } from "@/utils/gsdePdfExport";
import { downloadGsdeTournamentJson } from "@/utils/gsdeJsonExport";
import {
  GROUP_TIEBREAKER_LABELS,
  resolveGroupTiebreakers,
  type GroupTiebreaker,
} from "@/formats/group-double-elimination/groupStandings";
import {
  saveGsdeTournament,
  saveGsdeTournamentAtomic,
  type GsdeTournamentDocument,
} from "@/formats/group-double-elimination/persistence";
import { GROUP_DOUBLE_ELIMINATION_FORMAT } from "@/formats";
import {
  GsdeMainTitle,
  STATUS_LABEL,
  nameOf,
  statusColor,
  teamNameMap,
  useGsdeTournament,
} from "./shared";

interface Notice {
  kind: "ok" | "error";
  text: string;
}

interface ScoreDraft {
  a: string;
  b: string;
}

/** Elimination cards use the same plain score entry as group cards. */
type EliminationDraft = ScoreDraft;

const elDraftFromMatch = (match: EliminationMatch): EliminationDraft => ({
  a: match.scoreA === null ? "" : String(match.scoreA),
  b: match.scoreB === null ? "" : String(match.scoreB),
});

type AdminSection =
  | "overview"
  | "teams"
  | "players"
  | "pairing"
  | "matches"
  | "results"
  | "manage";
type ManageSection = "setup" | "flow" | "bracket" | "advanced" | "activity";
type ResultsSection = "groups" | "ranking" | "elimination" | "final";
type MatchStage = "group" | "elimination";

/* K&Q-style control recipes: large, high-contrast and touch friendly. */
const primaryBtn =
  "w-full touch-target bg-palm hover:bg-palm-dark text-white font-bold py-4 text-lg shadow-beach transition-all duration-300";
const outlineBtn =
  "w-full touch-target bg-white/70 hover:bg-ocean hover:text-white border-ocean/30 text-ocean font-semibold py-3 transition-all duration-300";
const dangerBtn =
  "w-full touch-target bg-white/70 hover:bg-coral hover:text-white border-coral/30 text-coral font-semibold py-3 transition-all duration-300";
const inputCls =
  "w-full h-12 text-base md:text-base touch-target bg-white/80 border-sand-dark/30 focus:border-ocean placeholder:text-foreground/40";
const selectCls =
  "w-full h-12 text-base touch-target rounded-xl border border-sand-dark/30 bg-white/80 px-3";
const scoreInputCls =
  "w-24 mx-auto text-center text-2xl md:text-2xl font-bold touch-target border-ocean/30 focus:border-ocean bg-white/80";
const scoreInputSunsetCls =
  "w-24 mx-auto text-center text-2xl md:text-2xl font-bold touch-target border-sunset/30 focus:border-sunset bg-white/80";

const tabButtonClass = (active: boolean) =>
  `touch-target rounded-xl px-2 py-3 text-sm font-bold transition-all duration-300 ${
    active
      ? "bg-beach-gradient text-white shadow-beach"
      : "bg-white/70 hover:bg-ocean hover:text-white border border-ocean/30 text-ocean shadow-sand"
  }`;

type PillTone = "palm" | "amber" | "coral" | "ocean" | "sunset" | "slate";

const pillTones: Record<PillTone, string> = {
  palm: "bg-palm/15 text-palm-dark border border-palm/30",
  amber: "bg-amber-100/70 text-amber-800 border border-amber-300/60",
  coral: "bg-coral/15 text-coral-dark border border-coral/30",
  ocean: "bg-ocean/15 text-ocean-dark border border-ocean/30",
  sunset: "bg-sunset/15 text-sunset-dark border border-sunset/30",
  slate: "bg-slate-100 text-slate-700 border border-slate-200",
};

function Pill({ tone, children }: { tone: PillTone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${pillTones[tone]}`}
    >
      {children}
    </span>
  );
}

/** Frosted K&Q-style card with a gradient-clipped heading. */
function SectionCard({
  emoji,
  title,
  gradient = "ocean",
  children,
}: {
  emoji: string;
  title: string;
  gradient?: "ocean" | "sunset";
  children: ReactNode;
}) {
  const gradientClass =
    gradient === "sunset" ? "bg-sunset-gradient" : "bg-ocean-gradient";
  return (
    <Card className="bg-white/80 backdrop-blur-sm border border-sand-dark/20 shadow-beach">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg sm:text-xl font-bold text-center flex items-center justify-center gap-2">
          <span aria-hidden="true" className="text-xl">
            {emoji}
          </span>
          <span className={`${gradientClass} bg-clip-text text-transparent`}>
            {title}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-sm font-semibold text-foreground/70">{label}</p>
      {children}
    </div>
  );
}

/** Compact tab bar used for both top-level and in-section navigation. */
function TabBar<T extends string>({
  options,
  value,
  onChange,
  columns = "grid-cols-2",
  label,
}: {
  options: ReadonlyArray<{ key: T; label: string; disabled?: boolean }>;
  value: T;
  onChange: (next: T) => void;
  columns?: string;
  label: string;
}) {
  return (
    <nav aria-label={label} className={`grid gap-2 ${columns}`}>
      {options.map((option) => (
        <button
          key={option.key}
          type="button"
          aria-pressed={value === option.key}
          disabled={option.disabled}
          className={tabButtonClass(value === option.key)}
          onClick={() => onChange(option.key)}
        >
          {option.label}
        </button>
      ))}
    </nav>
  );
}

/** K&Q medal-style ranking row, reused for all read-only standings. */
function RankRow({
  rank,
  name,
  detail,
  right,
}: {
  rank: number | null;
  name: string;
  detail?: string;
  right: ReactNode;
}) {
  const first = rank === 1;
  const second = rank === 2;
  const third = rank === 3;
  const rowClass = first
    ? "bg-sunset-gradient text-white"
    : second
      ? "bg-ocean/20 border-2 border-ocean/30"
      : third
        ? "bg-palm/20 border-2 border-palm/30"
        : "bg-sand-light/50";
  const accentClass = first
    ? "text-white"
    : second
      ? "text-ocean"
      : third
        ? "text-palm"
        : "text-foreground";
  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-xl p-4 shadow-sand ${rowClass}`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className={`text-xl font-bold ${accentClass}`}>
          {rank === null ? "–" : `#${rank}`}
        </span>
        <div className="min-w-0">
          <p className={`break-words font-bold text-lg ${accentClass}`}>{name}</p>
          {detail ? (
            <p className={`text-xs ${first ? "text-white/80" : "text-foreground/60"}`}>
              {detail}
            </p>
          ) : null}
        </div>
      </div>
      <div className={`shrink-0 text-right ${accentClass}`}>{right}</div>
    </div>
  );
}

export default function GroupDoubleEliminationAdminSetup() {
  const { id, setId, doc, loading, error } = useGsdeTournament();
  const [idDraft, setIdDraft] = useState(id);
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [division, setDivision] = useState("Open");
  const [category, setCategory] = useState<TournamentCategory>("Mixto");
  const [teamLimit, setTeamLimit] = useState("16");
  const [groupCount, setGroupCount] = useState("4");
  const [groupSize, setGroupSize] = useState("4");
  const [teamName, setTeamName] = useState("");
  const [teamSeed, setTeamSeed] = useState("");
  const [teamFilter, setTeamFilter] = useState<"all" | "pending" | "approved">("all");
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editSeed, setEditSeed] = useState("");
  const [groupScores, setGroupScores] = useState<Record<string, ScoreDraft>>({});
  const [eliminationScores, setEliminationScores] = useState<
    Record<string, EliminationDraft>
  >({});
  const [editingGroupMatchId, setEditingGroupMatchId] = useState<string | null>(null);
  const [editingEliminationMatchId, setEditingEliminationMatchId] = useState<string | null>(null);
  const [section, setSection] = useState<AdminSection>("overview");
  const [manageSection, setManageSection] = useState<ManageSection>("setup");
  const [resultsSection, setResultsSection] = useState<ResultsSection>("groups");
  const [matchStage, setMatchStage] = useState<MatchStage>("group");
  const [groupMatchIndex, setGroupMatchIndex] = useState(0);
  const [eliminationMatchIndex, setEliminationMatchIndex] = useState(0);
  const [overrideConfirmed, setOverrideConfirmed] = useState(false);
  const [reopenDiscardConfirmed, setReopenDiscardConfirmed] = useState(false);
  const [reopenTarget, setReopenTarget] = useState<"elimination" | "group-stage">("elimination");
  const [playerFilter, setPlayerFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");
  const [editingPlayerUid, setEditingPlayerUid] = useState<string | null>(null);
  const [editPlayerName, setEditPlayerName] = useState("");
  const [editPlayerEmail, setEditPlayerEmail] = useState("");
  const [editPlayerGender, setEditPlayerGender] = useState<PlayerGender>("male");
  const [pairFirstUid, setPairFirstUid] = useState("");
  const [pairSecondUid, setPairSecondUid] = useState("");
  const [pairChangeTeamId, setPairChangeTeamId] = useState("");
  const [pairChangeFirstUid, setPairChangeFirstUid] = useState("");
  const [pairChangeSecondUid, setPairChangeSecondUid] = useState("");
  const [actor, setActor] = useState<AuditActor>(UNKNOWN_ADMIN);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [resetConfirmed, setResetConfirmed] = useState(false);
  const [backupBeforeReset, setBackupBeforeReset] = useState(true);
  const [recomputeConfirmed, setRecomputeConfirmed] = useState(false);
  const [tiebreakOrder, setTiebreakOrder] = useState<GroupTiebreaker[]>([]);
  const [testResultMode, setTestResultMode] = useState<TestResultMode>("none");
  const [includeAuditLog, setIncludeAuditLog] = useState(false);

  // The admin page is behind the GSDE admin guard, so the signed-in user is the
  // actor recorded on every audit entry. Fall back to UNKNOWN_ADMIN if identity
  // is still resolving when an action is taken.
  useEffect(() => {
    let mounted = true;
    getCurrentUser()
      .then((user) => {
        if (!mounted || !user) return;
        setActor({
          id: user.uid,
          label: user.email ?? user.uid,
          isAdmin: true,
        });
      })
      .catch(() => {
        /* keep UNKNOWN_ADMIN fallback */
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    setIdDraft(id);
    setGroupMatchIndex(0);
    setEliminationMatchIndex(0);
    setEditingGroupMatchId(null);
    setEditingEliminationMatchId(null);
    setResetConfirmed(false);
  }, [id]);

  useEffect(() => {
    setName(doc?.tournament.config.name ?? "");
    setDate(doc?.tournament.config.date ?? "");
    setDivision(doc?.tournament.config.divisionName ?? "Open");
    setCategory(normalizeTournamentCategory(doc?.tournament.config.category));
    setTeamLimit(String(doc?.tournament.config.teamLimit ?? 16));
    setGroupCount(String(doc?.tournament.config.groupCount ?? 4));
    setGroupSize(String(doc?.tournament.config.teamsPerGroup ?? 4));
    setTiebreakOrder([...resolveGroupTiebreakers(doc?.settings.groupTiebreakers)]);
  }, [
    doc?.tournament.config.name,
    doc?.tournament.config.date,
    doc?.tournament.config.divisionName,
    doc?.tournament.config.category,
    doc?.tournament.config.teamLimit,
    doc?.tournament.config.groupCount,
    doc?.tournament.config.teamsPerGroup,
    doc?.settings.groupTiebreakers,
  ]);

  const status = doc?.tournament.status ?? "draft";
  const parsedTeamLimit = Number(teamLimit);
  const selectedTeamCount = (
    SUPPORTED_TEST_TEAM_COUNTS.includes(parsedTeamLimit as TestTeamCount)
      ? parsedTeamLimit
      : 16
  ) as TestTeamCount;
  const selectedGroupCount = GROUP_COUNT_BY_TEAM_COUNT[selectedTeamCount];
  const expectedPlayers = selectedTeamCount * 2;
  const expectedGroupMatches = selectedGroupCount * 6;
  const testResultSummary =
    testResultMode === "groups"
      ? `Random results for all ${expectedGroupMatches} group matches: winner 21, loser 0–19.`
      : testResultMode === "full"
        ? "Random results for the group stage and the entire elimination bracket, through to a champion: winner 21, loser 0–19."
        : "Only teams and the schedule are created; you enter the scores yourself.";
  const testLoadSuccess =
    testResultMode === "groups"
      ? `${selectedTeamCount} approved ${category} pairs loaded and ${expectedGroupMatches} random group results generated.`
      : testResultMode === "full"
        ? `${selectedTeamCount} approved ${category} pairs loaded; the full tournament was simulated to a champion.`
        : `${selectedTeamCount} approved ${category} pairs and ${expectedPlayers} players loaded; group schedule generated.`;
  const groupMatches = doc?.matches ?? [];
  const playableElimination = doc?.elimination
    ? [...doc.elimination.winners, ...doc.elimination.losers, ...doc.elimination.grandFinal]
        .filter((match) => match.teamAId !== null && match.teamBId !== null)
        .sort(
          (a, b) =>
            (getGameNumber(a.id) ?? Number.MAX_SAFE_INTEGER) -
            (getGameNumber(b.id) ?? Number.MAX_SAFE_INTEGER)
        )
    : [];
  const eliminationDone = playableElimination.filter(
    (match) => match.status === "completed"
  ).length;
  const completion = doc ? verifyGroupStageCompletion(doc) : null;
  const finalResult = doc ? selectFinalResult(doc) : null;
  const tournamentCompletion = doc ? selectCompletion(doc) : null;
  const approvedCount = doc ? selectApprovedTeamCount(doc) : 0;
  const corrections = doc ? selectCorrections(doc) : [];
  const registrationStats = doc ? getRegistrationStats(doc) : null;
  const allRegistrations = doc ? getRegistrations(doc) : [];
  const filteredRegistrations = allRegistrations.filter(
    (registration) => playerFilter === "all" || registration.status === playerFilter
  );
  const allInvitations: PairingInvitation[] = doc ? getPairingInvitations(doc) : [];
  const unpairedPlayers = doc ? selectUnpairedPlayers(doc) : [];
  const confirmedTeams = doc ? doc.teams.filter((team) => team.status !== "pending") : [];
  const pairingLocked = doc ? isPairingLocked(doc) : true;
  const names = doc ? teamNameMap(doc.teams, doc.registrations ?? []) : new Map();
  const groupTables = doc ? selectGroupStandings(doc) : [];
  const globalRanking = doc ? selectGlobalRanking(doc) : [];
  const eliminationStandings = doc ? selectEliminationStandings(doc) : [];
  const placements = doc ? selectPlacements(doc) : [];
  const activeMatches = matchStage === "group" ? groupMatches : playableElimination;
  const activeIndex = matchStage === "group" ? groupMatchIndex : eliminationMatchIndex;
  const activeGroupMatch =
    groupMatches[Math.min(groupMatchIndex, Math.max(0, groupMatches.length - 1))] ?? null;
  const activeEliminationMatch =
    playableElimination[
      Math.min(eliminationMatchIndex, Math.max(0, playableElimination.length - 1))
    ] ?? null;
  const activeMatch = matchStage === "group" ? activeGroupMatch : activeEliminationMatch;
  const remainingMatches = activeMatches.filter((match) => match.status !== "completed").length;
  const filteredTeams = (doc?.teams ?? []).filter((team) => {
    const approved = team.status !== "pending";
    return teamFilter === "all" || (teamFilter === "approved" ? approved : !approved);
  });
  const backTo = `${GROUP_DOUBLE_ELIMINATION_FORMAT.route}${id !== "default" ? `?id=${encodeURIComponent(id)}` : ""}`;
  const completionPercent =
    completion && completion.total > 0
      ? Math.round((completion.completed / completion.total) * 100)
      : 0;
  const winnerScoreConflicts = doc ? findWinnerScoreConflicts(doc) : [];

  useEffect(() => {
    if (groupMatchIndex >= groupMatches.length) {
      setGroupMatchIndex(Math.max(0, groupMatches.length - 1));
    }
  }, [groupMatches.length, groupMatchIndex]);

  useEffect(() => {
    if (eliminationMatchIndex >= playableElimination.length) {
      setEliminationMatchIndex(Math.max(0, playableElimination.length - 1));
    }
  }, [playableElimination.length, eliminationMatchIndex]);

  const apply = async (
    transform: (current: GsdeTournamentDocument) => GsdeTournamentDocument,
    successText: string,
    onSuccess?: () => void
  ) => {
    if (!doc) return;
    setSaving(true);
    setNotice(null);
    try {
      await saveGsdeTournament(transform(doc));
      setNotice({ kind: "ok", text: successText });
      onSuccess?.();
    } catch (caught) {
      setNotice({
        kind: "error",
        text: caught instanceof Error ? caught.message : "Unexpected error.",
      });
    } finally {
      setSaving(false);
    }
  };

  /** Atomic variant for approval and team changes, so concurrent edits cannot duplicate a pair. */
  const applyAtomic = async (
    transform: (current: GsdeTournamentDocument) => GsdeTournamentDocument,
    successText: string,
    onSuccess?: () => void
  ) => {
    setSaving(true);
    setNotice(null);
    try {
      await saveGsdeTournamentAtomic(id, transform);
      setNotice({ kind: "ok", text: successText });
      onSuccess?.();
    } catch (caught) {
      setNotice({
        kind: "error",
        text: caught instanceof Error ? caught.message : "Unexpected error.",
      });
    } finally {
      setSaving(false);
    }
  };

  /**
   * Admin-only entry point for the reusable demo participant. Auth is
   * provisioned on a secondary Firebase app so this admin session stays
   * signed in, then the ordinary simulator registers/approves/pairs the real
   * account. Repeating the click only reconciles the existing records.
   */
  const loadDemoTestData = async () => {
    if (!doc) return;
    setSaving(true);
    setNotice(null);
    try {
      const account = await ensureDemoPlayerAuth();
      const next = ensureDemoPlayerTestData(doc, actor, account, {
        results: testResultMode,
      });
      await saveGsdeTournament(next);
      setNotice({
        kind: "ok",
        text: account.created
          ? `${testLoadSuccess} Demo Player account created, approved and paired.`
          : `${testLoadSuccess} Existing Demo Player account reused and paired.`,
      });
    } catch (caught) {
      setNotice({
        kind: "error",
        text: caught instanceof Error ? caught.message : "Unexpected error.",
      });
    } finally {
      setSaving(false);
    }
  };

  const showError = (text: string) => setNotice({ kind: "error", text });

  const playerLabel = (uid: string): string => {
    const player = allRegistrations.find((item) => item.uid === uid);
    return player
      ? `${player.name}${player.gender ? ` (${player.gender})` : ""}`
      : uid;
  };

  const invitationTone = (status: PairingInvitation["status"]): PillTone => {
    if (status === "accepted") return "palm";
    if (status === "pending") return "amber";
    if (status === "declined") return "coral";
    return "slate";
  };

  const playerSelect = (
    value: string,
    onChange: (value: string) => void,
    label: string,
    excludeUid?: string,
    includeUids: string[] = []
  ) => {
    const unpairedUids = new Set(unpairedPlayers.map((player) => player.uid));
    return (
      <select
        aria-label={label}
        className={selectCls}
        value={value}
        disabled={saving || pairingLocked}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Choose a player…</option>
        {allRegistrations
          .filter(
            (player) =>
              (unpairedUids.has(player.uid) || includeUids.includes(player.uid)) &&
              player.uid !== excludeUid
          )
          .map((player) => (
            <option key={player.uid} value={player.uid}>
              {playerLabel(player.uid)} · {player.email}
            </option>
          ))}
      </select>
    );
  };

  // Shared destructive control: rendered on Overview and Manage → Setup so it
  // is always one screen away from where the admin lands.
  const resetCard = (
    <SectionCard emoji="🗑️" title="Delete all tournament data">
      <div className="space-y-3">
        <p className="text-sm text-foreground/70">
          Start this event over. Removes all teams, players, registrations, groups, matches,
          brackets and scores from{" "}
          <span className="font-semibold">{doc?.tournament.config.name || id}</span>. The event
          id, setup (name, date, category, team limit) and activity history are kept. Works at
          any stage, including a completed tournament, and cannot be undone.
        </p>
        {doc ? (
          <p className="rounded-xl bg-white/70 p-3 text-center text-xs font-semibold text-foreground/60 shadow-sand">
            Current: {doc.teams.length} teams · {(doc.registrations ?? []).length} registrations ·{" "}
            {doc.matches.length} group matches ·{" "}
            {doc.elimination ? "bracket generated" : "no bracket"}
          </p>
        ) : null}
        <label className="flex items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm text-foreground/80">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 accent-destructive"
            checked={resetConfirmed}
            onChange={(event) => setResetConfirmed(event.target.checked)}
          />
          <span>
            I understand this permanently deletes all tournament data for this event.
          </span>
        </label>
        <label className="flex items-start gap-3 rounded-xl border border-ocean/30 bg-ocean/5 p-3 text-sm text-foreground/80">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 accent-ocean"
            checked={backupBeforeReset}
            onChange={(event) => setBackupBeforeReset(event.target.checked)}
          />
          <span>Download a JSON backup of the current state before the reset.</span>
        </label>
        <Button
          className={dangerBtn}
          disabled={saving || !resetConfirmed}
          onClick={() => {
            if (backupBeforeReset && doc) downloadGsdeTournamentJson(doc);
            void apply(
              (current) => resetTournament(current, actor),
              "All tournament data cleared. Setup, settings and activity history kept.",
              () => setResetConfirmed(false)
            );
          }}
        >
          <Trash2 className="w-5 h-5 mr-2" />
          Delete all tournament data
        </Button>
      </div>
    </SectionCard>
  );

  const groupValue = (matchId: string, field: "a" | "b", fallback: number | null) =>
    groupScores[matchId]?.[field] ?? (fallback === null ? "" : String(fallback));

  const setGroupValue = (matchId: string, field: "a" | "b", value: string) =>
    setGroupScores((previous) => ({
      ...previous,
      [matchId]: {
        a: previous[matchId]?.a ?? "",
        b: previous[matchId]?.b ?? "",
        [field]: value,
      },
    }));

  const elValue = (match: EliminationMatch): EliminationDraft =>
    eliminationScores[match.id] ?? elDraftFromMatch(match);

  const setElValue = (matchId: string, patch: Partial<EliminationDraft>) =>
    setEliminationScores((previous) => {
      const base = previous[matchId] ?? { a: "", b: "" };
      return { ...previous, [matchId]: { ...base, ...patch } };
    });

  const advanceToNextOpen = (
    matches: ReadonlyArray<{ id: string; status: string }>,
    currentId: string,
    setter: (index: number) => void
  ) => {
    const current = matches.findIndex((match) => match.id === currentId);
    const next = matches.findIndex(
      (match, index) => index > current && match.status !== "completed"
    );
    const fallback = matches.findIndex((match) => match.status !== "completed");
    const target = next >= 0 ? next : fallback >= 0 ? fallback : current;
    if (target >= 0) setter(target);
  };

  const setActiveIndex = (next: number) => {
    const clamped = Math.max(0, Math.min(next, activeMatches.length - 1));
    if (matchStage === "group") setGroupMatchIndex(clamped);
    else setEliminationMatchIndex(clamped);
    setEditingGroupMatchId(null);
    setEditingEliminationMatchId(null);
  };

  const startGroupEdit = (matchId: string, a: number | null, b: number | null) => {
    setGroupScores((previous) => ({
      ...previous,
      [matchId]: { a: a === null ? "" : String(a), b: b === null ? "" : String(b) },
    }));
    setEditingGroupMatchId(matchId);
  };

  const cancelGroupEdit = (matchId: string) => {
    setGroupScores((previous) => {
      const next = { ...previous };
      delete next[matchId];
      return next;
    });
    setEditingGroupMatchId(null);
  };

  const startEliminationEdit = (match: EliminationMatch) => {
    setEliminationScores((previous) => ({
      ...previous,
      [match.id]: elDraftFromMatch(match),
    }));
    setEditingEliminationMatchId(match.id);
  };

  const cancelEliminationEdit = (matchId: string) => {
    setEliminationScores((previous) => {
      const next = { ...previous };
      delete next[matchId];
      return next;
    });
    setEditingEliminationMatchId(null);
  };

  const submitGroupScore = (matchId: string) => {
    if (!doc) return;
    const match = doc.matches.find((item) => item.id === matchId);
    if (!match) return;
    const aRaw = groupValue(matchId, "a", match.scoreA);
    const bRaw = groupValue(matchId, "b", match.scoreB);
    if (aRaw.trim() === "" || bRaw.trim() === "") {
      showError("Enter both scores.");
      return;
    }
    const a = Number(aRaw);
    const b = Number(bRaw);
    const wasComplete = match.status === "completed";
    const transform =
      wasComplete
        ? (current: GsdeTournamentDocument) =>
            correctGroupMatchScore(current, matchId, a, b, actor)
        : (current: GsdeTournamentDocument) =>
            scoreGroupMatch(current, matchId, a, b, actor);
    apply(
      transform,
      wasComplete ? "Group result corrected." : "Group score saved.",
      () => {
        setEditingGroupMatchId(null);
        if (!wasComplete) advanceToNextOpen(groupMatches, matchId, setGroupMatchIndex);
      }
    );
  };

  const applyTeamLimit = (value: string) => {
    const next = Number(value) as TestTeamCount;
    if (!SUPPORTED_TEST_TEAM_COUNTS.includes(next)) return;
    setTeamLimit(String(next));
    setGroupCount(String(GROUP_COUNT_BY_TEAM_COUNT[next]));
    setGroupSize("4");
  };

  const addTeam = () => {
    if (!doc) return;
    const seed = teamSeed.trim() === "" ? null : Number(teamSeed);
    // A team named by the admin keeps its name; player approval never renames it.
    const draft = { name: teamName, playerIds: [], seed, nameIsCustom: true };
    const issues = validateTeamDraft(draft, doc.teams);
    if (issues.length > 0) {
      showError(issues.map((issue) => issue.message).join(" "));
      return;
    }
    const team = createPendingTeam(createTeamId(teamName), draft, null);
    apply(
      (current) => addGsdeTeam(current, team, actor),
      `${team.name} registered (pending approval).`
    );
    setTeamName("");
    setTeamSeed("");
  };

  const saveTeamEdit = () => {
    if (!editingTeamId) return;
    const seed = editSeed.trim() === "" ? null : Number(editSeed);
    apply(
      (current) => editTeam(current, editingTeamId, { name: editName, seed }, actor),
      "Team updated."
    );
    setEditingTeamId(null);
  };

  const submitEliminationScore = (match: EliminationMatch) => {
    if (!doc?.elimination) return;
    if (!match.teamAId || !match.teamBId) {
      showError("Both teams must be known before scoring.");
      return;
    }
    const draft = elValue(match);
    if (draft.a.trim() === "" || draft.b.trim() === "") {
      showError("Enter both scores.");
      return;
    }
    const a = Number(draft.a);
    const b = Number(draft.b);
    const validation = validateScore(a, b, DEFAULT_SCORE_RULE);
    if (!validation.valid) {
      showError(validation.message ?? "Invalid score.");
      return;
    }

    // Only scores are submitted. The winner is derived from them by the
    // scoring engine and advances automatically — no manual result type.
    const outcome = { scoreA: a, scoreB: b };
    const wasComplete = match.status === "completed";
    const transform =
      wasComplete
        ? (current: GsdeTournamentDocument) =>
            correctEliminationResult(current, match.id, outcome, actor)
        : (current: GsdeTournamentDocument) =>
            scoreEliminationMatch(
              current,
              { matchId: match.id, ...outcome },
              actor
            );
    apply(
      transform,
      wasComplete ? "Result corrected and bracket recalculated." : "Result saved.",
      () => {
        setEditingEliminationMatchId(null);
        if (!wasComplete) advanceToNextOpen(playableElimination, match.id, setEliminationMatchIndex);
      }
    );
  };

  const nextStep = !doc
    ? "Loading tournament data…"
    : approvedCount !== selectedTeamCount
      ? `Register and approve ${Math.max(0, selectedTeamCount - approvedCount)} more team${selectedTeamCount - approvedCount === 1 ? "" : "s"}.`
      : groupMatches.length === 0
        ? "Build the group schedule in Manage → Flow."
        : status === "configured"
          ? "Start the group stage in Manage → Flow."
          : completion && !completion.isComplete
            ? `Enter the remaining ${completion.total - completion.completed} group scores in Matches.`
            : !doc.tournament.groupStageVerified
              ? "Verify and complete the group stage in Manage → Flow."
              : !doc.elimination
                ? "Generate the elimination bracket in Manage → Bracket."
                : eliminationDone < playableElimination.length
                  ? `Enter the remaining ${playableElimination.length - eliminationDone} bracket results in Matches.`
                  : tournamentCompletion && !tournamentCompletion.isComplete
                    ? `Resolve completion blocker: ${tournamentCompletion.issues[0] ?? "check Results."}`
                    : "Tournament complete — results are in Results.";

  const sectionOptions: ReadonlyArray<{ key: AdminSection; label: string }> = [
    { key: "overview", label: "🏠 Overview" },
    { key: "teams", label: "👥 Team setup" },
    { key: "players", label: "🙋 Player Management" },
    { key: "pairing", label: "💞 Team Management" },
    { key: "matches", label: "🏐 Tournament · Matches" },
    { key: "results", label: "🏆 Tournament · Results" },
    { key: "manage", label: "⚙️ Tournament Management" },
  ];

  const quickLinks: ReadonlyArray<{ key: AdminSection; label: string }> = [
    { key: "teams", label: "👥 Team setup" },
    { key: "players", label: "🙋 Player Management" },
    { key: "pairing", label: "💞 Team Management" },
    { key: "matches", label: "🏐 Tournament · Enter scores" },
    { key: "results", label: "🏆 Tournament · Results" },
    { key: "manage", label: "⚙️ Tournament Management" },
  ];

  return (
    <div className="min-h-screen bg-sand-gradient px-4 py-6">
      <div className="max-w-lg mx-auto space-y-6 animate-fade-in">
        <header className="flex flex-col items-center gap-6">
          <div className="w-full">
            <Link
              to={backTo}
              className="inline-flex items-center gap-1.5 text-sm font-bold text-ocean hover:text-ocean-dark transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              {GROUP_DOUBLE_ELIMINATION_FORMAT.shortName}
            </Link>
          </div>
          <div className="text-center relative w-full">
            <div className="w-full max-w-2xl mx-auto text-center px-4">
              <GsdeMainTitle />
              <div className="w-16 h-1 bg-sunset mx-auto rounded-full mt-4" />
              <p className="mt-3 text-sm font-medium text-foreground/70">
                Admin setup · tournament{" "}
                <span className="font-bold text-ocean">{id}</span>
              </p>
            </div>
          </div>

          <div className="w-full bg-white/70 backdrop-blur-sm rounded-xl p-3 border border-sand-dark/20 shadow-sand">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-wide text-foreground/50">
                Tournament status
              </span>
              <span
                className={`rounded-full px-3 py-1 text-xs font-bold ${statusColor(status)}`}
              >
                {STATUS_LABEL[status]}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-xl font-bold text-ocean">
                  {approvedCount}/{doc?.teams.length ?? 0}
                </p>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-foreground/50">
                  Teams
                </p>
              </div>
              <div>
                <p className="text-xl font-bold text-sunset-dark">
                  {completion?.completed ?? 0}/{completion?.total ?? 0}
                </p>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-foreground/50">
                  Group matches
                </p>
              </div>
              <div>
                <p className="text-xl font-bold text-palm">
                  {eliminationDone}/{playableElimination.length}
                </p>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-foreground/50">
                  Bracket
                </p>
              </div>
            </div>
          </div>
        </header>

        {notice ? (
          <div
            className={`rounded-xl border-2 p-3 shadow-beach backdrop-blur-sm flex items-center gap-2 text-sm font-bold ${
              notice.kind === "ok"
                ? "border-palm/30 bg-palm-light/20 text-palm-dark"
                : "border-coral/30 bg-coral/10 text-coral-dark"
            }`}
          >
            {notice.kind === "ok" ? (
              <CheckCircle2 className="w-5 h-5 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 shrink-0" />
            )}
            <span>{notice.text}</span>
          </div>
        ) : null}

        {winnerScoreConflicts.length > 0 ? (
          <div className="rounded-xl border-2 border-coral/40 bg-coral/10 p-3 shadow-beach">
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-coral-dark" />
              <div className="text-sm">
                <p className="font-bold text-coral-dark">Result data needs repair</p>
                <p className="mt-1 text-xs text-coral-dark/90">
                  {winnerScoreConflicts.length} elimination match
                  {winnerScoreConflicts.length === 1 ? "" : "es"} have a stored winner that
                  contradicts the score:{" "}
                  {winnerScoreConflicts
                    .map((conflict) => getGameLabel(conflict.matchId))
                    .join(", ")}
                  . Open Manage → Bracket → “Recompute bracket from results” to repair them.
                </p>
              </div>
            </div>
          </div>
        ) : null}

        <main className="space-y-6">
          {loading ? (
            <Card className="bg-white/80 backdrop-blur-sm border border-sand-dark/20 shadow-beach">
              <CardContent className="flex flex-col items-center justify-center gap-3 py-10 text-foreground/60">
                <span className="text-4xl animate-bounce-gentle">🏐</span>
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading tournament…
                </p>
              </CardContent>
            </Card>
          ) : error ? (
            <Card className="bg-white/80 backdrop-blur-sm border-2 border-coral/30 shadow-beach">
              <CardContent className="p-4 text-sm font-semibold text-coral-dark">
                Could not load Firestore data: {error}
              </CardContent>
            </Card>
          ) : doc ? (
            <>
              <div className="sticky top-2 z-20 rounded-2xl bg-white/80 backdrop-blur-sm border border-sand-dark/20 shadow-beach p-2">
                <TabBar<AdminSection>
                  label="Admin sections"
                  options={sectionOptions}
                  value={section}
                  onChange={setSection}
                  columns="grid-cols-3"
                />
              </div>

              {section === "overview" ? (
                <div className="space-y-6">
                  <SectionCard emoji="🧭" title="Tournament overview">
                    <div className="rounded-xl border border-palm/20 bg-palm/10 p-4 text-center">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-palm-dark/70">
                        Next step
                      </p>
                      <p className="mt-1 text-sm font-bold text-palm-dark">{nextStep}</p>
                    </div>
                    <div className="rounded-xl bg-white/70 p-4 shadow-sand">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-semibold text-foreground/60">Group stage</span>
                        <span className="font-bold text-ocean">
                          {completion?.completed ?? 0}/{completion?.total ?? 0}
                        </span>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-sand-dark/20">
                        <div
                          className="h-full rounded-full bg-ocean-gradient transition-all duration-500"
                          style={{ width: `${completionPercent}%` }}
                        />
                      </div>
                      <div className="mt-3 flex items-center justify-between text-sm">
                        <span className="font-semibold text-foreground/60">Elimination bracket</span>
                        <span className="font-bold text-palm">
                          {eliminationDone}/{playableElimination.length}
                        </span>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-sand-dark/20">
                        <div
                          className="h-full rounded-full bg-beach-gradient transition-all duration-500"
                          style={{
                            width: `${playableElimination.length ? Math.round((eliminationDone / playableElimination.length) * 100) : 0}%`,
                          }}
                        />
                      </div>
                    </div>
                    <p className="text-center text-xs text-foreground/55">
                      Choose where to go — only the selected area is shown.
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {quickLinks.map((link) => (
                        <button
                          key={link.key}
                          type="button"
                          className={tabButtonClass(false)}
                          onClick={() => setSection(link.key)}
                        >
                          {link.label}
                        </button>
                      ))}
                    </div>
                  </SectionCard>

                  {resetCard}

                  {doc.tournament.seedingStale ? (
                    <div className="rounded-xl border border-amber-300/60 bg-amber-50/70 p-4 text-sm text-amber-900">
                      <strong>Provisional bracket.</strong> Seeded from provisional group standings.
                      Regenerate from the final verified standings before entering results.
                    </div>
                  ) : null}

                  {tournamentCompletion && !tournamentCompletion.isComplete &&
                  tournamentCompletion.issues.length > 0 ? (
                    <div className="rounded-xl border border-amber-300/60 bg-amber-50/70 p-4 text-sm text-amber-900">
                      <strong>Completion blockers:</strong>
                      <ul className="mt-1 list-disc pl-5">
                        {tournamentCompletion.issues.map((issue) => (
                          <li key={issue}>{issue}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {finalResult?.complete ? (
                    <div className="rounded-2xl bg-beach-gradient p-6 text-white shadow-beach">
                      <div className="space-y-4 rounded-2xl border border-white/20 bg-white/15 p-6 text-center shadow-xl backdrop-blur-md">
                        <p className="text-2xl font-extrabold">👑 Tournament complete 👑</p>
                        <div className="rounded-xl border border-yellow-400/30 bg-yellow-500/20 p-4">
                          <p className="text-lg font-bold">Champion</p>
                          <p className="text-2xl font-extrabold tracking-wide">
                            {finalResult.championTeamIds
                              .map((teamId) => nameOf(names, teamId))
                              .join(" / ")}
                          </p>
                        </div>
                        <div className="rounded-xl border border-white/15 bg-white/10 p-4">
                          <p className="text-lg font-bold">Runner-up</p>
                          <p className="text-xl font-bold">
                            {finalResult.runnerUpTeamIds
                              .map((teamId) => nameOf(names, teamId))
                              .join(" / ")}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {section === "teams" ? (
                <SectionCard
                  emoji="👥"
                  title={`Teams · ${approvedCount} of ${doc.teams.length} approved`}
                >
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Team name">
                      <Input
                        className={inputCls}
                        value={teamName}
                        placeholder="e.g. Team Sunset"
                        onChange={(event) => setTeamName(event.target.value)}
                      />
                    </Field>
                    <Field label="Seed (optional)">
                      <Input
                        className={inputCls}
                        type="number"
                        min={1}
                        value={teamSeed}
                        onChange={(event) => setTeamSeed(event.target.value)}
                      />
                    </Field>
                  </div>
                  <Button
                    className={primaryBtn}
                    disabled={saving || doc.teams.length >= selectedTeamCount}
                    onClick={addTeam}
                  >
                    <Plus className="w-5 h-5 mr-2" />
                    Register team
                  </Button>

                  <div className="grid grid-cols-3 gap-2">
                    {(["all", "pending", "approved"] as const).map((filter) => (
                      <button
                        key={filter}
                        type="button"
                        className={tabButtonClass(teamFilter === filter)}
                        onClick={() => setTeamFilter(filter)}
                      >
                        {filter === "all" ? "All" : filter === "pending" ? "Pending" : "Approved"}
                      </button>
                    ))}
                  </div>

                  <div className="space-y-2">
                    {filteredTeams.map((team) => {
                      const approved = team.status !== "pending";
                      return (
                        <div
                          key={team.id}
                          className={`rounded-xl border-2 p-3 shadow-sand ${
                            approved
                              ? "border-palm/30 bg-palm-light/10"
                              : "border-amber-300/60 bg-amber-50/80"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="break-words text-base font-bold text-foreground">
                                {names.get(team.id) ?? team.name}
                              </p>
                              <p className="break-words text-xs font-semibold text-foreground/60">
                                {getTeamPlayerNames(doc.registrations ?? [], team).join(" / ") ||
                                  "Players assigned by admin"}
                              </p>
                              <p className="text-xs font-semibold text-ocean">
                                {team.seed ? `Seed #${team.seed}` : "Unseeded"}
                              </p>
                            </div>
                            <Pill tone={approved ? "palm" : "amber"}>
                              {approved ? "Approved" : "Pending"}
                            </Pill>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {!approved ? (
                              <Button
                                className="flex-1 touch-target bg-palm hover:bg-palm-dark text-white font-semibold py-3"
                                disabled={saving}
                                onClick={() =>
                                  apply(
                                    (current) => approveTeam(current, team.id, true, actor),
                                    `${team.name} approved.`
                                  )
                                }
                              >
                                <CheckCircle2 className="w-4 h-4 mr-1" />
                                Approve
                              </Button>
                            ) : null}
                            <Button
                              className="flex-1 touch-target bg-white/70 hover:bg-ocean hover:text-white border-ocean/30 text-ocean font-semibold py-3"
                              disabled={saving || doc.matches.length > 0}
                              onClick={() => {
                                setEditingTeamId(team.id);
                                setEditName(team.name);
                                setEditSeed(team.seed === null ? "" : String(team.seed));
                              }}
                            >
                              <Pencil className="w-4 h-4 mr-1" />
                              Edit
                            </Button>
                            <Button
                              className="flex-1 touch-target bg-white/70 hover:bg-coral hover:text-white border-coral/30 text-coral font-semibold py-3"
                              disabled={saving || doc.matches.length > 0}
                              onClick={() =>
                                team.status === "confirmed"
                                  ? applyAtomic(
                                      (current) => adminRemovePairing(current, team.id, actor),
                                      "Team dissolved; both players remain approved and unpaired."
                                    )
                                  : apply(
                                      (current) => removeTeam(current, team.id, actor),
                                      `${team.name} removed.`
                                    )
                              }
                            >
                              <Trash2 className="w-4 h-4 mr-1" />
                              Remove
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                    {filteredTeams.length === 0 ? (
                      <p className="rounded-xl bg-sand-light/50 p-4 text-center text-sm font-semibold text-foreground/60">
                        No teams match this filter.
                      </p>
                    ) : null}
                  </div>

                  {editingTeamId ? (
                    <div className="space-y-3 rounded-xl border-2 border-ocean/20 bg-ocean/5 p-4">
                      <p className="text-sm font-bold text-ocean">Edit team</p>
                      <Field label="Name">
                        <Input className={inputCls} value={editName} onChange={(e) => setEditName(e.target.value)} />
                      </Field>
                      <Field label="Seed">
                        <Input className={inputCls} type="number" min={1} value={editSeed} onChange={(e) => setEditSeed(e.target.value)} />
                      </Field>
                      <div className="flex gap-2">
                        <Button className="flex-1 touch-target bg-palm hover:bg-palm-dark text-white font-bold py-3" disabled={saving} onClick={saveTeamEdit}>
                          Save team
                        </Button>
                        <Button className="flex-1 touch-target bg-white/70 border-ocean/30 text-ocean font-semibold py-3" onClick={() => setEditingTeamId(null)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : null}

                  {approvedCount !== selectedTeamCount ? (
                    <p className="text-center text-xs font-semibold text-amber-800">
                      Register and approve exactly {selectedTeamCount} two-player teams ({expectedPlayers} players) to generate the groups.
                    </p>
                  ) : null}
                </SectionCard>
              ) : null}

              {section === "players" ? (
                <SectionCard emoji="🙋" title="Player Management" gradient="sunset">
                  <p className="text-center text-sm text-foreground/65">
                    {registrationStats?.pending ?? 0} pending ·{" "}
                    {registrationStats?.approved ?? 0} approved ·{" "}
                    {registrationStats?.rejected ?? 0} rejected ·{" "}
                    {registrationStats?.approvedUnpaired ?? 0} approved &amp; unpaired
                  </p>
                  <p className="text-center text-xs text-foreground/55">
                    Approve each individual player first. Team creation is handled separately in
                    Team Management. Editing a player never changes their approval status.
                  </p>
                  <TabBar<typeof playerFilter>
                    label="Player status filter"
                    columns="grid-cols-2 sm:grid-cols-4"
                    options={
                      [
                        { key: "pending", label: "Pending" },
                        { key: "approved", label: "Approved" },
                        { key: "rejected", label: "Rejected" },
                        { key: "all", label: "All" },
                      ] as ReadonlyArray<{ key: typeof playerFilter; label: string }>
                    }
                    value={playerFilter}
                    onChange={setPlayerFilter}
                  />
                  {allRegistrations.length === 0 ? (
                    <p className="rounded-xl bg-sand-light/50 p-4 text-center text-sm font-semibold text-foreground/60">
                      No players have registered yet. Share the registration page with players.
                    </p>
                  ) : filteredRegistrations.length === 0 ? (
                    <p className="rounded-xl bg-sand-light/50 p-4 text-center text-sm font-semibold text-foreground/60">
                      No {playerFilter} players.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {filteredRegistrations.map((registration) => {
                        const pairingStatus = getPairingStatusForPlayer(doc, registration.uid);
                        const teamId = getRegisteredTeamId(doc, registration.uid);
                        const teamName = teamId ? names.get(teamId) ?? teamId : null;
                        const editing = editingPlayerUid === registration.uid;
                        const tone =
                          registration.status === "approved"
                            ? "palm"
                            : registration.status === "rejected"
                              ? "coral"
                              : "amber";
                        return (
                          <div
                            key={registration.uid}
                            className="space-y-3 rounded-xl border border-sand-dark/20 bg-white/70 p-4 shadow-sand"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="break-words text-lg font-bold text-foreground">
                                  {registration.name}
                                </p>
                                <p className="break-all text-xs text-foreground/55">
                                  {registration.email}
                                </p>
                                <p className="text-xs font-semibold text-ocean">
                                  {registration.gender === "male"
                                    ? "Male"
                                    : registration.gender === "female"
                                      ? "Female"
                                      : "Gender not supplied"}
                                </p>
                              </div>
                              <Pill tone={tone}>{registration.status}</Pill>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-sm text-foreground/65">
                              <span className="font-semibold">Pairing:</span>
                              <Pill
                                tone={
                                  pairingStatus === "paired"
                                    ? "palm"
                                    : pairingStatus === "searching" ||
                                        pairingStatus === "invite-sent" ||
                                        pairingStatus === "invite-received"
                                      ? "slate"
                                      : pairingStatus === "rejected"
                                        ? "coral"
                                        : "amber"
                                }
                              >
                                {pairingStatus.replace(/-/g, " ")}
                              </Pill>
                              {teamName ? (
                                <span className="break-words font-bold text-ocean">{teamName}</span>
                              ) : null}
                            </div>
                            {editing ? (
                              <div className="space-y-3 rounded-xl border-2 border-ocean/20 bg-ocean/5 p-4">
                                <Field label="Player name">
                                  <Input
                                    value={editPlayerName}
                                    onChange={(event) => setEditPlayerName(event.target.value)}
                                  />
                                </Field>
                                <Field label="Email address">
                                  <Input
                                    type="email"
                                    value={editPlayerEmail}
                                    onChange={(event) => setEditPlayerEmail(event.target.value)}
                                  />
                                </Field>
                                <Field label="Gender">
                                  <select
                                    aria-label="Edit player gender"
                                    className={selectCls}
                                    value={editPlayerGender}
                                    onChange={(event) =>
                                      setEditPlayerGender(event.target.value as PlayerGender)
                                    }
                                  >
                                    <option value="male">Male</option>
                                    <option value="female">Female</option>
                                  </select>
                                </Field>
                                <div className="flex flex-wrap gap-2">
                                  <Button
                                    className="flex-1 touch-target bg-ocean hover:bg-ocean-dark text-white font-semibold py-3"
                                    disabled={saving}
                                    onClick={() =>
                                      applyAtomic(
                                        (current) =>
                                          editPlayerRegistration(
                                            current,
                                            registration.uid,
                                            {
                                              name: editPlayerName,
                                              email: editPlayerEmail,
                                              gender: editPlayerGender,
                                            },
                                            actor
                                          ),
                                        `${registration.name}'s details were updated.`,
                                        () => setEditingPlayerUid(null)
                                      )
                                    }
                                  >
                                    <Check className="w-4 h-4 mr-1" />
                                    Save details
                                  </Button>
                                  <Button
                                    className="flex-1 touch-target bg-white/70 border-sand-dark/30 text-foreground/60 font-semibold py-3"
                                    disabled={saving}
                                    onClick={() => setEditingPlayerUid(null)}
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                            ) : null}
                            <div className="flex flex-wrap gap-2">
                              {registration.status !== "approved" ? (
                                <Button
                                  className="flex-1 touch-target bg-palm hover:bg-palm-dark text-white font-semibold py-3"
                                  disabled={saving}
                                  onClick={() =>
                                    applyAtomic(
                                      (current) =>
                                        approvePlayerRegistration(current, registration.uid, actor),
                                      `${registration.name} approved as an individual player.`,
                                      () => setEditingPlayerUid(null)
                                    )
                                  }
                                >
                                  <CheckCircle2 className="w-4 h-4 mr-1" />
                                  Approve
                                </Button>
                              ) : null}
                              {registration.status !== "rejected" ? (
                                <Button
                                  className="flex-1 touch-target bg-white/70 hover:bg-coral hover:text-white border-coral/30 text-coral font-semibold py-3"
                                  disabled={saving}
                                  onClick={() =>
                                    applyAtomic(
                                      (current) =>
                                        rejectPlayerRegistration(current, registration.uid, actor),
                                      `${registration.name}'s registration was rejected.`,
                                      () => setEditingPlayerUid(null)
                                    )
                                  }
                                >
                                  Reject
                                </Button>
                              ) : null}
                              <Button
                                className="flex-1 touch-target bg-white/70 border-ocean/30 text-ocean font-semibold py-3"
                                disabled={saving}
                                onClick={() => {
                                  setEditingPlayerUid(registration.uid);
                                  setEditPlayerName(registration.name);
                                  setEditPlayerEmail(registration.email);
                                  setEditPlayerGender(
                                    registration.gender === "female" ? "female" : "male"
                                  );
                                }}
                              >
                                <Pencil className="w-4 h-4 mr-1" />
                                Edit
                              </Button>
                              <Button
                                className="flex-1 touch-target bg-white/70 border-sand-dark/30 text-foreground/60 font-semibold py-3"
                                disabled={saving}
                                onClick={() =>
                                  applyAtomic(
                                    (current) =>
                                      removePlayerRegistration(current, registration.uid, actor),
                                    `${registration.name}'s registration was removed.`,
                                    () => setEditingPlayerUid(null)
                                  )
                                }
                              >
                                <Trash2 className="w-4 h-4 mr-1" />
                                Remove
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </SectionCard>
              ) : null}

              {section === "pairing" ? (
                <SectionCard emoji="💞" title="Team Management" gradient="sunset">
                  <p className="text-center text-sm text-foreground/65">
                    {confirmedTeams.length} confirmed · {unpairedPlayers.length} approved &amp; unpaired ·{" "}
                    {allInvitations.filter((item) => item.status === "pending").length} pending invitations
                  </p>
                  <p className="text-center text-xs text-foreground/55">
                    Only approved, unpaired players can be paired. Mutual player agreement or an admin
                    action creates one confirmed team with two players and an automatic display name.
                    Changing or dissolving a team never changes player approval.
                  </p>
                  {pairingLocked ? (
                    <p className="rounded-xl border border-amber-300/60 bg-amber-50/80 p-3 text-center text-xs font-semibold text-amber-800">
                      Team changes are locked — registration closes when the group stage starts.
                    </p>
                  ) : null}

                  <div className="space-y-3">
                    <p className="text-sm font-bold">Confirmed teams</p>
                    {confirmedTeams.length === 0 ? (
                      <p className="rounded-xl bg-sand-light/50 p-4 text-center text-sm font-semibold text-foreground/60">
                        No confirmed teams yet.
                      </p>
                    ) : (
                      confirmedTeams.map((team) => (
                        <div
                          key={team.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-palm/30 bg-palm/5 p-3 shadow-sand"
                        >
                          <div className="min-w-0">
                            <p className="break-words text-sm font-bold text-ocean">
                              {names.get(team.id) ?? team.name}
                            </p>
                            <p className="break-all text-xs text-foreground/60">
                              {team.playerIds.map(playerLabel).join(" / ")}
                            </p>
                          </div>
                          <Pill tone="palm">confirmed</Pill>
                          <p className="w-full break-all text-[10px] text-foreground/45">ID: {team.id}</p>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="space-y-3 rounded-xl border-2 border-ocean/20 bg-ocean/5 p-4">
                    <p className="text-sm font-bold text-ocean">Create a pair manually</p>
                    <Field label="First player">
                      {playerSelect(pairFirstUid, setPairFirstUid, "First player")}
                    </Field>
                    <Field label="Second player">
                      {playerSelect(pairSecondUid, setPairSecondUid, "Second player", pairFirstUid)}
                    </Field>
                    <Button
                      className={primaryBtn}
                      disabled={saving || pairingLocked || !pairFirstUid || !pairSecondUid}
                      onClick={() =>
                        applyAtomic(
                          (current) => adminCreatePairTeam(current, pairFirstUid, pairSecondUid, actor),
                          "Confirmed team created.",
                          () => {
                            setPairFirstUid("");
                            setPairSecondUid("");
                          }
                        )
                      }
                    >
                      <Plus className="w-5 h-5 mr-2" />
                      Create pair
                    </Button>
                  </div>

                  <div className="space-y-3 rounded-xl border-2 border-sunset/20 bg-sunset/5 p-4">
                    <p className="text-sm font-bold text-sunset-dark">Change or dissolve a team</p>
                    <Field label="Team">
                      <select
                        aria-label="Team to change"
                        className={selectCls}
                        value={pairChangeTeamId}
                        disabled={saving || pairingLocked}
                        onChange={(event) => {
                          const teamId = event.target.value;
                          setPairChangeTeamId(teamId);
                          const team = doc.teams.find((item) => item.id === teamId);
                          setPairChangeFirstUid(team?.playerIds[0] ?? "");
                          setPairChangeSecondUid(team?.playerIds[1] ?? "");
                        }}
                      >
                        <option value="">Choose a team…</option>
                        {doc.teams.map((team) => (
                          <option key={team.id} value={team.id}>
                            {names.get(team.id) ?? team.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                    {pairChangeTeamId ? (
                      <>
                        <Field label="New first player">
                          {playerSelect(
                            pairChangeFirstUid,
                            setPairChangeFirstUid,
                            "New first player",
                            undefined,
                            doc.teams.find((item) => item.id === pairChangeTeamId)?.playerIds ?? []
                          )}
                        </Field>
                        <Field label="New second player">
                          {playerSelect(
                            pairChangeSecondUid,
                            setPairChangeSecondUid,
                            "New second player",
                            pairChangeFirstUid,
                            doc.teams.find((item) => item.id === pairChangeTeamId)?.playerIds ?? []
                          )}
                        </Field>
                        <Button
                          className={primaryBtn}
                          disabled={
                            saving ||
                            pairingLocked ||
                            !pairChangeFirstUid ||
                            !pairChangeSecondUid
                          }
                          onClick={() =>
                            applyAtomic(
                              (current) =>
                                adminChangePairing(
                                  current,
                                  pairChangeTeamId,
                                  pairChangeFirstUid,
                                  pairChangeSecondUid,
                                  actor
                                ),
                              "Team membership updated; approval unchanged.",
                              () => {
                                setPairChangeTeamId("");
                                setPairChangeFirstUid("");
                                setPairChangeSecondUid("");
                              }
                            )
                          }
                        >
                          Save pair change
                        </Button>
                        <Button
                          className={dangerBtn}
                          disabled={saving || pairingLocked}
                          onClick={() =>
                            applyAtomic(
                              (current) => adminRemovePairing(current, pairChangeTeamId, actor),
                              "Team dissolved; both players remain approved and unpaired.",
                              () => {
                                setPairChangeTeamId("");
                                setPairChangeFirstUid("");
                                setPairChangeSecondUid("");
                              }
                            )
                          }
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Dissolve team
                        </Button>
                      </>
                    ) : null}
                  </div>

                  <div className="space-y-3">
                    <p className="text-sm font-bold">Pairing invitations</p>
                    {allInvitations.length === 0 ? (
                      <p className="rounded-xl bg-sand-light/50 p-4 text-center text-sm font-semibold text-foreground/60">
                        No invitations have been sent yet.
                      </p>
                    ) : (
                      allInvitations.map((invite) => (
                        <div
                          key={invite.id}
                          className="space-y-2 rounded-xl border border-sand-dark/20 bg-white/70 p-4 shadow-sand"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="break-words text-sm font-bold text-foreground">
                              {playerLabel(invite.inviterUid)} → {playerLabel(invite.inviteeUid)}
                            </p>
                            <Pill tone={invitationTone(invite.status)}>{invite.status}</Pill>
                          </div>
                          <p className="text-xs text-foreground/60">
                            Category: {invite.category} · Team:{" "}
                            {invite.teamId ? names.get(invite.teamId) ?? invite.teamId : "—"}
                          </p>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="space-y-3">
                    <p className="text-sm font-bold">Approved, unpaired players</p>
                    {unpairedPlayers.length === 0 ? (
                      <p className="rounded-xl bg-sand-light/50 p-4 text-center text-sm font-semibold text-foreground/60">
                        No approved players are waiting for a partner.
                      </p>
                    ) : (
                      unpairedPlayers.map((registration) => {
                        const pairingStatus = getPairingStatusForPlayer(doc, registration.uid);
                        return (
                          <div
                            key={registration.uid}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-sand-dark/20 bg-white/70 p-3 shadow-sand"
                          >
                            <div className="min-w-0">
                              <p className="break-words text-sm font-bold text-foreground">
                                {registration.name}
                              </p>
                              <p className="break-all text-xs text-foreground/55">
                                {registration.email}
                              </p>
                            </div>
                            <Pill
                              tone={
                                pairingStatus === "paired"
                                  ? "palm"
                                  : pairingStatus === "searching" ||
                                      pairingStatus === "invite-sent" ||
                                      pairingStatus === "invite-received"
                                    ? "slate"
                                    : "amber"
                              }
                            >
                              {pairingStatus.replace(/-/g, " ")}
                            </Pill>
                          </div>
                        );
                      })
                    )}
                  </div>
                </SectionCard>
              ) : null}

              {section === "matches" ? (
                <SectionCard
                  emoji={matchStage === "group" ? "🏐" : "🏆"}
                  title={matchStage === "group" ? "Group-stage match" : "Elimination match"}
                  gradient={matchStage === "group" ? "ocean" : "sunset"}
                >
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      aria-pressed={matchStage === "group"}
                      className={tabButtonClass(matchStage === "group")}
                      onClick={() => {
                        setMatchStage("group");
                        setEditingGroupMatchId(null);
                      }}
                    >
                      Group ({groupMatches.length})
                    </button>
                    <button
                      type="button"
                      aria-pressed={matchStage === "elimination"}
                      disabled={playableElimination.length === 0}
                      className={tabButtonClass(matchStage === "elimination")}
                      onClick={() => {
                        setMatchStage("elimination");
                        setEditingEliminationMatchId(null);
                      }}
                    >
                      Elimination ({playableElimination.length})
                    </button>
                  </div>

                  {activeMatches.length === 0 ? (
                    <div className="space-y-3 rounded-xl bg-sand-light/50 p-4 text-center">
                      <p className="text-sm font-semibold text-foreground/65">
                        {matchStage === "group"
                          ? "No group matches yet."
                          : "No elimination bracket yet."}
                      </p>
                      <p className="text-xs text-foreground/55">
                        {matchStage === "group"
                          ? "Build the schedule from Manage → Flow."
                          : "Generate the bracket from Manage → Bracket."}
                      </p>
                      <Button
                        className={outlineBtn}
                        onClick={() => {
                          setManageSection(matchStage === "group" ? "flow" : "bracket");
                          setSection("manage");
                        }}
                      >
                        Open tournament controls
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          aria-label="Previous match"
                          disabled={activeIndex <= 0}
                          className="flex-1 touch-target rounded-xl bg-white/70 hover:bg-ocean hover:text-white border border-ocean/30 text-ocean font-bold py-3 disabled:opacity-40"
                          onClick={() => setActiveIndex(activeIndex - 1)}
                        >
                          <span className="inline-flex items-center justify-center gap-1">
                            <ChevronLeft className="w-5 h-5" />
                            Previous
                          </span>
                        </button>
                        <div className="min-w-[76px] text-center">
                          <p className="text-sm font-bold text-ocean">
                            {Math.min(activeIndex + 1, activeMatches.length)} / {activeMatches.length}
                          </p>
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-foreground/55">
                            {remainingMatches} left
                          </p>
                        </div>
                        <button
                          type="button"
                          aria-label="Next match"
                          disabled={activeIndex >= activeMatches.length - 1}
                          className="flex-1 touch-target rounded-xl bg-white/70 hover:bg-ocean hover:text-white border border-ocean/30 text-ocean font-bold py-3 disabled:opacity-40"
                          onClick={() => setActiveIndex(activeIndex + 1)}
                        >
                          <span className="inline-flex items-center justify-center gap-1">
                            Next
                            <ChevronRight className="w-5 h-5" />
                          </span>
                        </button>
                      </div>

                      <Field label="Jump to match">
                        <select
                          aria-label="Jump to match"
                          className={selectCls}
                          value={Math.min(activeIndex, activeMatches.length - 1)}
                          onChange={(event) => setActiveIndex(Number(event.target.value))}
                        >
                          {activeMatches.map((match, index) => {
                            const teamA = nameOf(names, match.teamAId);
                            const teamB = nameOf(names, match.teamBId);
                            const label =
                              matchStage === "elimination"
                                ? getGameNumber(match.id) === null
                                  ? match.id
                                  : getGameLabel(match.id)
                                : `Match ${index + 1}`;
                            return (
                              <option key={match.id} value={index}>
                                {label} · {teamA} vs {teamB}
                              </option>
                            );
                          })}
                        </select>
                      </Field>

                      {activeMatch ? (
                        matchStage === "group" ? (
                          (() => {
                            const match = activeGroupMatch;
                            if (!match) return null;
                            const complete = match.status === "completed";
                            const editing = editingGroupMatchId === match.id;
                            const a = groupValue(match.id, "a", match.scoreA);
                            const b = groupValue(match.id, "b", match.scoreB);
                            const submission = findSubmissionForMatch(doc, match.id);
                            const group = doc.groups.find((item) => item.id === match.groupId);
                            const teamA = nameOf(names, match.teamAId);
                            const teamB = nameOf(names, match.teamBId);
                            return (
                              <div
                                className={`space-y-3 rounded-xl border-2 p-4 shadow-beach ${
                                  complete
                                    ? "border-palm/30 bg-palm-light/10"
                                    : "border-sand-dark/20 bg-white/70"
                                }`}
                              >
                                <div className="text-center">
                                  <p className="text-sm font-bold text-foreground/60">
                                    {group?.name ?? match.groupId} · Round {match.round}
                                  </p>
                                  <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
                                    {submission ? (
                                      <Pill tone="ocean">Submitted by {submission.playerLabel}</Pill>
                                    ) : null}
                                    <Pill tone={complete ? "palm" : match.status === "ready" ? "ocean" : "slate"}>
                                      {complete ? "Final" : match.status === "ready" ? "Ready" : "Pending"}
                                    </Pill>
                                  </div>
                                </div>

                                <div className="text-center space-y-3">
                                  <div className="rounded-xl bg-ocean px-4 py-4 text-white shadow-beach">
                                    <p className="break-words text-xl font-bold">{teamA}</p>
                                  </div>
                                  {complete && !editing ? (
                                    <div className="rounded-xl bg-ocean py-4 text-white shadow-beach">
                                      <p className="text-4xl font-bold">{match.scoreA}</p>
                                    </div>
                                  ) : (
                                    <Input
                                      aria-label={`${teamA} score`}
                                      className={scoreInputCls}
                                      type="number"
                                      min={0}
                                      value={a}
                                      onChange={(e) => setGroupValue(match.id, "a", e.target.value)}
                                      placeholder="0"
                                    />
                                  )}
                                </div>

                                <div className="flex items-center justify-center">
                                  <div className="rounded-full bg-sunset-gradient px-8 py-3 text-xl font-bold text-white shadow-beach">
                                    ⚡ VS ⚡
                                  </div>
                                </div>

                                <div className="text-center space-y-3">
                                  <div className="rounded-xl bg-sunset px-4 py-4 text-white shadow-beach">
                                    <p className="break-words text-xl font-bold">{teamB}</p>
                                  </div>
                                  {complete && !editing ? (
                                    <div className="rounded-xl bg-sunset py-4 text-white shadow-beach">
                                      <p className="text-4xl font-bold">{match.scoreB}</p>
                                    </div>
                                  ) : (
                                    <Input
                                      aria-label={`${teamB} score`}
                                      className={scoreInputSunsetCls}
                                      type="number"
                                      min={0}
                                      value={b}
                                      onChange={(e) => setGroupValue(match.id, "b", e.target.value)}
                                      placeholder="0"
                                    />
                                  )}
                                </div>

                                {complete && !editing ? (
                                  <>
                                    <div className="flex items-center justify-center gap-2 rounded-xl border border-palm/20 bg-palm/10 p-3">
                                      <Check className="w-5 h-5 text-palm" />
                                      <p className="font-bold text-palm-dark">
                                        Final score: {match.scoreA} - {match.scoreB}
                                      </p>
                                    </div>
                                    <div className="flex gap-2">
                                      <Button
                                        className="flex-1 touch-target bg-white/70 hover:bg-ocean hover:text-white border-ocean/30 text-ocean font-semibold py-3"
                                        disabled={saving}
                                        onClick={() => startGroupEdit(match.id, match.scoreA, match.scoreB)}
                                      >
                                        <Pencil className="w-4 h-4 mr-1" />
                                        Edit score
                                      </Button>
                                      <Button
                                        className="flex-1 touch-target bg-white/70 hover:bg-coral hover:text-white border-coral/30 text-coral font-semibold py-3"
                                        disabled={saving}
                                        onClick={() => {
                                          if (
                                            !window.confirm(
                                              "Clear this group result? The score will be removed and the group stage will reopen."
                                            )
                                          ) {
                                            return;
                                          }
                                          if (backupBeforeReset && doc) {
                                            downloadGsdeTournamentJson(doc);
                                          }
                                          void apply(
                                            (current) => resetGroupMatch(current, match.id, actor),
                                            "Result cleared."
                                          );
                                        }}
                                      >
                                        <RotateCcw className="w-4 h-4 mr-1" />
                                        Clear
                                      </Button>
                                    </div>
                                  </>
                                ) : complete ? (
                                  <div className="flex gap-2">
                                    <Button
                                      className="flex-1 touch-target bg-palm hover:bg-palm-dark text-white font-bold py-3"
                                      disabled={saving}
                                      onClick={() => submitGroupScore(match.id)}
                                    >
                                      <CheckCircle2 className="w-4 h-4 mr-1" />
                                      Save changes
                                    </Button>
                                    <Button
                                      className="flex-1 touch-target bg-white/70 hover:bg-coral hover:text-white border-coral/30 text-coral font-semibold py-3"
                                      disabled={saving}
                                      onClick={() => cancelGroupEdit(match.id)}
                                    >
                                      Cancel
                                    </Button>
                                  </div>
                                ) : (
                                  <div className="space-y-2">
                                    {match.status === "pending" ? (
                                      <Button
                                        className={outlineBtn}
                                        disabled={saving}
                                        onClick={() =>
                                          apply(
                                            (current) => startGroupMatch(current, match.id, actor),
                                            "Match started."
                                          )
                                        }
                                      >
                                        <Play className="w-5 h-5 mr-2" />
                                        Start match
                                      </Button>
                                    ) : null}
                                    <Button
                                      className={primaryBtn}
                                      disabled={saving}
                                      onClick={() => submitGroupScore(match.id)}
                                    >
                                      <CheckCircle2 className="w-5 h-5 mr-2" />
                                      Save score
                                    </Button>
                                  </div>
                                )}
                              </div>
                            );
                          })()
                        ) : (() => {
                          const match = activeEliminationMatch;
                          if (!match) return null;
                          const complete = match.status === "completed";
                          const editing = editingEliminationMatchId === match.id;
                          const draft = elValue(match);
                          const submission = findSubmissionForMatch(doc, match.id);
                          const gameNumber = getGameNumber(match.id);
                          const teamA = nameOf(names, match.teamAId);
                          const teamB = nameOf(names, match.teamBId);
                          const winnerId = getWinner(match);
                          const showInputs = !complete || editing;
                          const previewValid =
                            draft.a.trim() !== "" &&
                            draft.b.trim() !== "" &&
                            validateScore(
                              Number(draft.a),
                              Number(draft.b),
                              DEFAULT_SCORE_RULE
                            ).valid;
                          const previewWinner = previewValid
                            ? Number(draft.a) > Number(draft.b)
                              ? teamA
                              : teamB
                            : null;
                          return (
                            <div
                              className={`space-y-3 rounded-xl border-2 p-4 shadow-beach ${
                                complete
                                  ? "border-palm/30 bg-palm-light/10"
                                  : "border-sand-dark/20 bg-white/70"
                              }`}
                            >
                              <div className="text-center">
                                <p className="text-sm font-bold text-ocean">
                                  {gameNumber === null ? match.id : getGameLabel(match.id)} ·{" "}
                                  {match.phase === "grand-final" ? "Grand Final" : match.phase} R{match.round}
                                </p>
                                <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
                                  {submission ? (
                                    <Pill tone="ocean">Submitted by {submission.playerLabel}</Pill>
                                  ) : null}
                                  <Pill tone={complete ? "palm" : match.status === "ready" ? "ocean" : "slate"}>
                                    {complete ? "Final" : match.status === "ready" ? "Ready" : "Pending"}
                                  </Pill>
                                </div>
                              </div>

                              <div className="text-center space-y-3">
                                <div className="rounded-xl bg-ocean px-4 py-4 text-white shadow-beach">
                                  <p className="break-words text-xl font-bold">{teamA}</p>
                                </div>
                                {showInputs ? (
                                  <Input
                                    aria-label={`${teamA} score`}
                                    className={scoreInputCls}
                                    type="number"
                                    min={0}
                                    value={draft.a}
                                    onChange={(e) => setElValue(match.id, { a: e.target.value })}
                                    placeholder="0"
                                  />
                                ) : (
                                  <div className="rounded-xl bg-ocean py-4 text-white shadow-beach">
                                    <p className="text-4xl font-bold">{match.scoreA}</p>
                                  </div>
                                )}
                              </div>

                              <div className="flex items-center justify-center">
                                <div className="rounded-full bg-sunset-gradient px-8 py-3 text-xl font-bold text-white shadow-beach">
                                  ⚡ VS ⚡
                                </div>
                              </div>

                              <div className="text-center space-y-3">
                                <div className="rounded-xl bg-sunset px-4 py-4 text-white shadow-beach">
                                  <p className="break-words text-xl font-bold">{teamB}</p>
                                </div>
                                {showInputs ? (
                                  <Input
                                    aria-label={`${teamB} score`}
                                    className={scoreInputSunsetCls}
                                    type="number"
                                    min={0}
                                    value={draft.b}
                                    onChange={(e) => setElValue(match.id, { b: e.target.value })}
                                    placeholder="0"
                                  />
                                ) : (
                                  <div className="rounded-xl bg-sunset py-4 text-white shadow-beach">
                                    <p className="text-4xl font-bold">{match.scoreB}</p>
                                  </div>
                                )}
                              </div>

                              {showInputs ? (
                                <p className="text-center text-xs text-foreground/60">
                                  {previewWinner
                                    ? `Higher valid score wins · ${previewWinner} advances`
                                    : "Enter both scores — the winner must reach 21 and lead by 2."}
                                </p>
                              ) : (
                                <div className="text-center">
                                  <Pill tone="palm">
                                    👑 {nameOf(names, winnerId)} won {match.scoreA} - {match.scoreB}
                                  </Pill>
                                </div>
                              )}

                              {complete && !editing ? (
                                <Button
                                  className={outlineBtn}
                                  disabled={saving}
                                  onClick={() => startEliminationEdit(match)}
                                >
                                  <Pencil className="w-4 h-4 mr-1" />
                                  Edit result
                                </Button>
                              ) : complete ? (
                                <div className="flex gap-2">
                                  <Button
                                    className="flex-1 touch-target bg-palm hover:bg-palm-dark text-white font-bold py-3"
                                    disabled={saving}
                                    onClick={() => submitEliminationScore(match)}
                                  >
                                    <CheckCircle2 className="w-4 h-4 mr-1" />
                                    Save changes
                                  </Button>
                                  <Button
                                    className="flex-1 touch-target bg-white/70 hover:bg-coral hover:text-white border-coral/30 text-coral font-semibold py-3"
                                    disabled={saving}
                                    onClick={() => cancelEliminationEdit(match.id)}
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              ) : (
                                <Button
                                  className={primaryBtn}
                                  disabled={saving}
                                  onClick={() => submitEliminationScore(match)}
                                >
                                  <CheckCircle2 className="w-5 h-5 mr-2" />
                                  Save result
                                </Button>
                              )}
                            </div>
                          );
                        })()
                      ) : null}
                    </>
                  )}
                </SectionCard>
              ) : null}

              {section === "results" ? (
                <div className="space-y-6">
                  <SectionCard emoji="📄" title="Download tournament PDF">
                    <div className="space-y-3 text-center">
                      <p className="text-sm text-foreground/70">
                        Export the teams, group standings and results, global ranking,
                        elimination results and final placements in the same printable
                        King &amp; Queen-style format. Admin action logs are not included
                        unless you opt in below.
                      </p>
                      <label className="flex items-center justify-center gap-2 text-sm font-medium text-foreground/80">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-ocean"
                          checked={includeAuditLog}
                          onChange={(event) => setIncludeAuditLog(event.target.checked)}
                        />
                        Include audit log (separate final page)
                      </label>
                      <Button
                        className={primaryBtn}
                        disabled={!doc || saving}
                        onClick={() =>
                          void exportGsdeTournamentPdf(doc, { includeAuditLog })
                        }
                      >
                        <FileText className="w-5 h-5 mr-2" />
                        Download PDF
                      </Button>
                      <Button
                        className={outlineBtn}
                        disabled={!doc || saving}
                        onClick={() => {
                          if (!doc) return;
                          const file = downloadGsdeTournamentJson(doc);
                          setNotice({ kind: "ok", text: `Backup saved: ${file}` });
                        }}
                      >
                        Download JSON backup
                      </Button>
                    </div>
                  </SectionCard>
                  {finalResult?.complete ? (
                    <div className="rounded-2xl bg-beach-gradient p-6 text-white shadow-beach">
                      <div className="space-y-4 rounded-2xl border border-white/20 bg-white/15 p-6 text-center shadow-xl backdrop-blur-md">
                        <p className="text-2xl font-extrabold">👑 Tournament complete 👑</p>
                        <div className="rounded-xl border border-yellow-400/30 bg-yellow-500/20 p-4">
                          <p className="text-lg font-bold">Champion</p>
                          <p className="text-2xl font-extrabold tracking-wide">
                            {finalResult.championTeamIds
                              .map((teamId) => nameOf(names, teamId))
                              .join(" / ")}
                          </p>
                        </div>
                        <div className="rounded-xl border border-white/15 bg-white/10 p-4">
                          <p className="text-lg font-bold">Runner-up</p>
                          <p className="text-xl font-bold">
                            {finalResult.runnerUpTeamIds
                              .map((teamId) => nameOf(names, teamId))
                              .join(" / ")}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  <TabBar<ResultsSection>
                    label="Result views"
                    columns="grid-cols-2 sm:grid-cols-4"
                    value={resultsSection}
                    onChange={setResultsSection}
                    options={[
                      { key: "groups", label: "Groups" },
                      { key: "ranking", label: "Ranking" },
                      { key: "elimination", label: "Elimination" },
                      { key: "final", label: "Final" },
                    ]}
                  />

                  {resultsSection === "groups" ? (
                    groupTables.length > 0 ? (
                      <SectionCard emoji="🥇" title="Group standings">
                        <div className="space-y-5">
                          {groupTables.map((table) => {
                            const group = doc.groups.find((item) => item.id === table.groupId);
                            return (
                              <div key={table.groupId} className="space-y-2">
                                <p className="text-sm font-bold text-ocean">
                                  {group?.name ?? table.groupId}
                                </p>
                                <div className="space-y-2">
                                  {table.rows.map((row) => (
                                    <RankRow
                                      key={row.teamId}
                                      rank={row.rank}
                                      name={nameOf(names, row.teamId)}
                                      detail={`${row.wins}W · ${row.losses}L${
                                        row.tiebreakUsed
                                          ? ` · ${GROUP_TIEBREAKER_LABELS[row.tiebreakUsed]}`
                                          : ""
                                      }`}
                                      right={
                                        <p className="text-sm font-bold tabular-nums">
                                          {row.pointDifference > 0 ? "+" : ""}
                                          {row.pointDifference}
                                        </p>
                                      }
                                    />
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        <p className="text-center text-xs text-foreground/55">
                          All four teams qualify. Group losses never count as elimination losses.
                        </p>
                      </SectionCard>
                    ) : (
                      <p className="rounded-xl bg-sand-light/50 p-4 text-center text-sm font-semibold text-foreground/60">
                        No group standings yet — build and play the group schedule first.
                      </p>
                    )
                  ) : null}

                  {resultsSection === "ranking" ? (
                    globalRanking.length > 0 ? (
                      <SectionCard emoji="🏅" title="Overall group ranking">
                        <div className="space-y-2">
                          {globalRanking.map((row) => (
                            <RankRow
                              key={row.teamId}
                              rank={row.globalRank}
                              name={nameOf(names, row.teamId)}
                              detail={`Group ${row.groupRank} · ${row.wins}W · ${row.losses}L`}
                              right={
                                <p className="text-sm font-bold tabular-nums">
                                  {row.pointDifference > 0 ? "+" : ""}
                                  {row.pointDifference}
                                </p>
                              }
                            />
                          ))}
                        </div>
                      </SectionCard>
                    ) : (
                      <p className="rounded-xl bg-sand-light/50 p-4 text-center text-sm font-semibold text-foreground/60">
                        No overall ranking yet.
                      </p>
                    )
                  ) : null}

                  {resultsSection === "elimination" ? (
                    eliminationStandings.length > 0 ? (
                      <SectionCard emoji="⚔️" title="Elimination standings" gradient="sunset">
                        <div className="space-y-2">
                          {eliminationStandings.map((row) => (
                            <RankRow
                              key={row.teamId}
                              rank={row.rank}
                              name={nameOf(names, row.teamId)}
                              detail={`${row.wins}W · ${row.losses}L`}
                              right={
                                <Pill tone={row.status === "champion" ? "palm" : row.status === "eliminated" ? "coral" : "ocean"}>
                                  {row.status}
                                </Pill>
                              }
                            />
                          ))}
                        </div>
                      </SectionCard>
                    ) : (
                      <p className="rounded-xl bg-sand-light/50 p-4 text-center text-sm font-semibold text-foreground/60">
                        No elimination standings yet — generate the bracket first.
                      </p>
                    )
                  ) : null}

                  {resultsSection === "final" ? (
                    placements.length > 0 ? (
                      <SectionCard emoji="🎖️" title="Final placements">
                        <div className="grid gap-2 sm:grid-cols-2">
                          {placements.map((placement) => (
                            <div
                              key={placement.place}
                              className="rounded-xl border border-sand-dark/20 bg-white/70 p-3 shadow-sand"
                            >
                              <p className="text-sm font-bold text-ocean">Place #{placement.place}</p>
                              <div className="mt-1 space-y-1">
                                {placement.teamIds.map((teamId) => (
                                  <p key={teamId} className="break-words text-base font-semibold text-foreground">
                                    {nameOf(names, teamId)}
                                  </p>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </SectionCard>
                    ) : (
                      <p className="rounded-xl bg-sand-light/50 p-4 text-center text-sm font-semibold text-foreground/60">
                        Final placements appear once the bracket is complete.
                      </p>
                    )
                  ) : null}
                </div>
              ) : null}

              {section === "manage" ? (
                <div className="space-y-6">
                  <TabBar<ManageSection>
                    label="Management sections"
                    columns="grid-cols-2 sm:grid-cols-3"
                    value={manageSection}
                    onChange={setManageSection}
                    options={[
                      { key: "setup", label: "⚙️ Setup" },
                      { key: "flow", label: "▶️ Flow" },
                      { key: "bracket", label: "🌳 Bracket" },
                      { key: "advanced", label: "↩️ Advanced" },
                      { key: "activity", label: "📋 Activity" },
                    ]}
                  />

                  {manageSection === "setup" ? (
                    <>
                    <SectionCard emoji="⚙️" title="Tournament setup">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="sm:col-span-2">
                          <Field label="Event id">
                            <div className="flex gap-2">
                              <Input
                                className={`${inputCls} flex-1`}
                                value={idDraft}
                                onChange={(event) => setIdDraft(event.target.value)}
                              />
                              <Button
                                type="button"
                                variant="outline"
                                className="touch-target px-5 bg-white/70 border-ocean/30 text-ocean font-semibold"
                                onClick={() => setId(idDraft)}
                              >
                                Switch
                              </Button>
                            </div>
                          </Field>
                        </div>
                        <Field label="Tournament name">
                          <Input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
                        </Field>
                        <Field label="Date">
                          <Input className={inputCls} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                        </Field>
                        <Field label="Division">
                          <Input className={inputCls} value={division} onChange={(e) => setDivision(e.target.value)} />
                        </Field>
                        <Field label="Category">
                          <select
                            aria-label="Tournament category"
                            className={selectCls}
                            value={category}
                            onChange={(event) =>
                              setCategory(normalizeTournamentCategory(event.target.value))
                            }
                          >
                            {TOURNAMENT_CATEGORY_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </Field>
                        <Field label="Team limit">
                          <select
                            aria-label="Team limit"
                            className={selectCls}
                            value={teamLimit}
                            onChange={(event) => applyTeamLimit(event.target.value)}
                          >
                            {SUPPORTED_TEST_TEAM_COUNTS.map((count) => (
                              <option key={count} value={count}>
                                {count} teams · {count * 2} players
                              </option>
                            ))}
                          </select>
                        </Field>
                        <Field label="Number of groups">
                          <Input className={inputCls} type="number" min={1} value={groupCount} readOnly />
                        </Field>
                        <Field label="Group size">
                          <Input className={inputCls} type="number" min={2} value={groupSize} readOnly />
                        </Field>
                      </div>
                      <Button
                        className={primaryBtn}
                        disabled={saving}
                        onClick={() =>
                          apply(
                            (current) =>
                              saveSetup(current, {
                                ...current.tournament.config,
                                name,
                                date,
                                divisionName: division,
                                category: normalizeTournamentCategory(category),
                                teamLimit: selectedTeamCount,
                                groupCount: Number(groupCount),
                                teamsPerGroup: Number(groupSize),
                              }),
                            "Setup saved."
                          )
                        }
                      >
                        Save setup
                      </Button>
                      <p className="text-center text-xs text-foreground/55">
                        2x2 {category} format: {selectedTeamCount} teams · {expectedPlayers} players · {selectedGroupCount} groups of 4.
                      </p>
                    </SectionCard>

                    <SectionCard emoji="⚙️" title="Scoring & tiebreak rules">
                      <div className="space-y-3">
                        <p className="text-sm text-foreground/70">
                          Every match uses beach-volleyball scoring: the winner must
                          reach at least 21 points and lead by 2 (22–20, 23–21,
                          25–23, …). There is no upper score cap.
                        </p>
                        <p className="text-sm font-semibold text-foreground/80">
                          Group tiebreak order (first rule that breaks the tie wins):
                        </p>
                        <ol className="space-y-2">
                          {tiebreakOrder.map((key, index) => (
                            <li
                              key={key}
                              className="flex items-center justify-between rounded-xl border border-sand-dark/20 bg-white/70 px-3 py-2 text-sm"
                            >
                              <span>
                                {index + 1}. {GROUP_TIEBREAKER_LABELS[key]}
                              </span>
                              <span className="flex gap-2">
                                <button
                                  type="button"
                                  aria-label={`Move ${GROUP_TIEBREAKER_LABELS[key]} up`}
                                  className="rounded-lg border border-ocean/30 px-2 py-1 text-xs text-ocean disabled:opacity-30"
                                  disabled={index === 0}
                                  onClick={() =>
                                    setTiebreakOrder((previous) => {
                                      const next = [...previous];
                                      [next[index - 1], next[index]] = [
                                        next[index],
                                        next[index - 1],
                                      ];
                                      return next;
                                    })
                                  }
                                >
                                  ↑
                                </button>
                                <button
                                  type="button"
                                  aria-label={`Move ${GROUP_TIEBREAKER_LABELS[key]} down`}
                                  className="rounded-lg border border-ocean/30 px-2 py-1 text-xs text-ocean disabled:opacity-30"
                                  disabled={index === tiebreakOrder.length - 1}
                                  onClick={() =>
                                    setTiebreakOrder((previous) => {
                                      const next = [...previous];
                                      [next[index], next[index + 1]] = [
                                        next[index + 1],
                                        next[index],
                                      ];
                                      return next;
                                    })
                                  }
                                >
                                  ↓
                                </button>
                              </span>
                            </li>
                          ))}
                        </ol>
                        <Button
                          className={outlineBtn}
                          disabled={saving}
                          onClick={() => {
                            void apply(
                              (current) => ({
                                ...current,
                                settings: {
                                  ...current.settings,
                                  scoreRule: DEFAULT_SCORE_RULE.rule,
                                  scoreCap: null,
                                  groupTiebreakers: tiebreakOrder,
                                },
                              }),
                              "Scoring and tiebreak rules saved."
                            );
                          }}
                        >
                          Save rules
                        </Button>
                      </div>
                    </SectionCard>

                    <SectionCard emoji="🧪" title="Test teams & players">
                      <div className="space-y-3">
                        <p className="text-sm text-foreground/70">
                          Creates {selectedTeamCount} approved {category} pairs ({expectedPlayers} players)
                          inside this tournament, generates the group schedule and links the reusable
                          Demo Player account to one confirmed pair. Only available before the group
                          stage starts, or to refresh an already-loaded demo setup.
                        </p>
                        <Field label="Results after loading">
                          <select
                            aria-label="Test result simulation"
                            className={selectCls}
                            value={testResultMode}
                            onChange={(event) =>
                              setTestResultMode(event.target.value as TestResultMode)
                            }
                          >
                            {TEST_RESULT_MODE_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </Field>
                        <p className="text-center text-xs text-foreground/55">
                          {testResultSummary}
                        </p>
                        <Button
                          className={primaryBtn}
                          disabled={saving || !canLoadDemoTestData(doc)}
                          onClick={() => void loadDemoTestData()}
                        >
                          <Zap className="w-5 h-5 mr-2" />
                          Load test teams &amp; players
                        </Button>
                        {!canLoadDemoTestData(doc) ? (
                          <p className="text-center text-xs text-foreground/55">
                            Test data can only be loaded in draft/configured with no matches. Use
                            &quot;Delete all tournament data&quot; below to start over first.
                          </p>
                        ) : null}
                      </div>
                    </SectionCard>

                    {resetCard}
                    </>
                  ) : null}

                  {manageSection === "flow" ? (
                    <SectionCard emoji="▶️" title="Tournament flow">
                      <div className="space-y-3">
                        <p className="rounded-xl bg-white/70 p-3 text-center text-xs font-semibold text-foreground/60 shadow-sand">
                          Need placeholder teams? Load test teams &amp; players from the
                          <button
                            type="button"
                            className="ml-1 font-bold text-ocean underline"
                            onClick={() => setManageSection("setup")}
                          >
                            Setup
                          </button>
                          tab.
                        </p>
                        <Button
                          className={outlineBtn}
                          disabled={saving || approvedCount !== selectedTeamCount}
                          onClick={() =>
                            apply(
                              (current) => buildTeamsAndGroups(current, current.teams, actor),
                              `${selectedGroupCount} groups and ${expectedGroupMatches} matches generated.`
                            )
                          }
                        >
                          Build groups &amp; schedule
                        </Button>
                        <Button
                          className={outlineBtn}
                          disabled={saving || doc.matches.length !== expectedGroupMatches || status !== "configured"}
                          onClick={() => apply((current) => startGroupStage(current, actor), "Group stage started.")}
                        >
                          <Play className="w-5 h-5 mr-2" />
                          Start group stage
                        </Button>
                      </div>
                      <p className="text-center text-xs text-foreground/55">
                        Groups can only be rebuilt while the tournament is still in setup. Use
                        &quot;Delete all tournament data&quot; on the Overview or Setup tab to start over.
                      </p>
                      <div className="space-y-3 rounded-xl bg-white/70 p-4 text-center shadow-sand">
                        <p className="text-2xl font-bold text-ocean">
                          {completion?.completed ?? 0} / {completion?.total ?? 0}
                        </p>
                        <p className="text-sm font-semibold text-foreground/60">
                          Group matches complete
                        </p>
                        <div className="h-2 overflow-hidden rounded-full bg-sand-dark/20">
                          <div
                            className="h-full rounded-full bg-ocean-gradient transition-all duration-500"
                            style={{ width: `${completionPercent}%` }}
                          />
                        </div>
                        <Button
                          className={primaryBtn}
                          disabled={saving || !completion?.isComplete}
                          onClick={() =>
                            apply(
                              (current) => completeGroupStage(current, actor),
                              "Group stage verified and final ranking calculated."
                            )
                          }
                        >
                          <Trophy className="w-5 h-5 mr-2" />
                          Verify &amp; complete
                        </Button>
                        {doc.tournament.groupStageVerified ? (
                          <Pill tone="palm">Group stage verified</Pill>
                        ) : null}
                      </div>
                    </SectionCard>
                  ) : null}

                  {manageSection === "bracket" ? (
                    <SectionCard emoji="🌳" title="Elimination bracket">
                      <div className="space-y-3">
                        <Button
                          className={primaryBtn}
                          disabled={saving || !completion?.isComplete}
                          onClick={() =>
                            apply(
                              (current) => generateEliminationBracket(current, {}, actor),
                              "Standard double-elimination bracket generated."
                            )
                          }
                        >
                          Generate bracket
                        </Button>
                        <Button
                          className={outlineBtn}
                          disabled={saving || !doc.elimination}
                          onClick={() => {
                            if (
                              !window.confirm(
                                "Reset the unstarted bracket? Any unplayed match slots will be cleared. Entered results must be absent; otherwise use “Recompute bracket from results”."
                              )
                            ) {
                              return;
                            }
                            if (backupBeforeReset && doc) downloadGsdeTournamentJson(doc);
                            void apply(
                              (current) => resetEliminationBracket(current, actor),
                              "Unstarted bracket reset."
                            );
                          }}
                        >
                          <RotateCcw className="w-5 h-5 mr-2" />
                          Reset bracket
                        </Button>
                        <div className="space-y-3 rounded-xl border-2 border-ocean/30 bg-ocean/5 p-4">
                          <p className="text-sm font-semibold text-ocean-dark">
                            Repair a saved bracket
                          </p>
                          <p className="text-xs text-foreground/70">
                            Rebuild routing from the canonical source of truth and replay every
                            saved result. Use this when Games 27/28 are crossed or Game 29 is
                            missing. Scores are kept; incompatible results are flagged for review.
                          </p>
                          <label className="flex items-start gap-3 text-sm font-medium text-foreground/80">
                            <input
                              type="checkbox"
                              className="mt-1 h-4 w-4 accent-ocean"
                              checked={recomputeConfirmed}
                              onChange={(event) => setRecomputeConfirmed(event.target.checked)}
                            />
                            <span>
                              I understand the bracket will be recalculated from saved results.
                            </span>
                          </label>
                          <Button
                            className={outlineBtn}
                            disabled={saving || !doc.elimination || !recomputeConfirmed}
                            onClick={() => {
                              if (backupBeforeReset && doc) downloadGsdeTournamentJson(doc);
                              void apply(
                                (current) => recomputeBracketFromResults(current, actor),
                                "Bracket recomputed from saved results.",
                                () => setRecomputeConfirmed(false)
                              );
                            }}
                          >
                            <Zap className="w-5 h-5 mr-2" />
                            Recompute bracket from results
                          </Button>
                        </div>
                        {doc.tournament.seedingStale ? (
                          <div className="text-center">
                            <Pill tone="amber">Seeding changed — regenerate</Pill>
                          </div>
                        ) : null}
                      </div>
                      <div className="space-y-3 rounded-xl border-2 border-amber-300/60 bg-amber-50/80 p-4">
                        <label className="flex items-start gap-3 text-sm font-medium text-amber-900">
                          <input
                            type="checkbox"
                            className="mt-0.5 h-5 w-5 shrink-0"
                            checked={overrideConfirmed}
                            onChange={(e) => setOverrideConfirmed(e.target.checked)}
                          />
                          I confirm this bracket is provisional while group matches are still incomplete.
                        </label>
                        <Button
                          className="w-full touch-target bg-white/70 hover:bg-amber-500 hover:text-white border-amber-300/60 text-amber-900 font-semibold py-3"
                          disabled={saving || !overrideConfirmed || Boolean(completion?.isComplete)}
                          onClick={() =>
                            apply(
                              (current) =>
                                generateEliminationBracket(
                                  current,
                                  { overrideIncomplete: true, adminConfirmed: true },
                                  actor
                                ),
                              "Provisional bracket generated from partial standings."
                            )
                          }
                        >
                          Generate with override
                        </Button>
                      </div>
                    </SectionCard>
                  ) : null}

                  {manageSection === "advanced" ? (
                    <SectionCard emoji="↩️" title="Advanced controls" gradient="sunset">
                      {finalResult?.complete ? (
                        <div className="space-y-4">
                          <p className="text-center text-sm text-foreground/65">
                            Reopening discards results from the chosen stage onward and is recorded in the
                            activity log. Admin only.
                          </p>
                          <Field label="Reopen to stage">
                            <select
                              className={selectCls}
                              value={reopenTarget}
                              onChange={(event) =>
                                setReopenTarget(event.target.value as "elimination" | "group-stage")
                              }
                            >
                              <option value="elimination">Double elimination (keep group results)</option>
                              <option value="group-stage">Group stage (also discard bracket)</option>
                            </select>
                          </Field>
                          <label className="flex items-start gap-3 text-sm font-medium text-foreground/75">
                            <input
                              type="checkbox"
                              className="mt-0.5 h-5 w-5 shrink-0"
                              checked={reopenDiscardConfirmed}
                              onChange={(event) => setReopenDiscardConfirmed(event.target.checked)}
                            />
                            I confirm later-stage results will be discarded.
                          </label>
                          <Button
                            className={dangerBtn}
                            disabled={saving || !reopenDiscardConfirmed}
                            onClick={() =>
                              apply(
                                (current) =>
                                  reopenTournament(current, actor, {
                                    targetStage: reopenTarget,
                                    discardResults: true,
                                  }),
                                `Tournament reopened to ${reopenTarget}.`
                              )
                            }
                          >
                            <RotateCcw className="w-5 h-5 mr-2" />
                            Reopen tournament
                          </Button>
                        </div>
                      ) : (
                        <p className="rounded-xl bg-sand-light/50 p-4 text-center text-sm font-semibold text-foreground/60">
                          Reopen is available once the tournament is complete.
                        </p>
                      )}
                      <p className="text-center text-xs text-foreground/50">
                        This page only reads and writes{" "}
                        <code className="rounded bg-white/70 px-1 py-0.5">tournaments/{`{id}`}</code>.
                        King &amp; Queen data is never touched.
                      </p>
                    </SectionCard>
                  ) : null}

                  {manageSection === "activity" ? (
                    <SectionCard emoji="📋" title={`Activity log · ${corrections.length}`}>
                      {corrections.length === 0 ? (
                        <p className="rounded-xl bg-sand-light/50 p-4 text-center text-sm font-semibold text-foreground/60">
                          No corrections or reopenings have been recorded yet.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {[...corrections]
                            .reverse()
                            .slice(0, 50)
                            .map((entry) => (
                              <div
                                key={entry.id}
                                className="rounded-xl border border-sand-dark/20 bg-white/60 p-3 text-xs text-foreground/75 shadow-sand"
                              >
                                <p className="font-bold text-ocean">{entry.action}</p>
                                <p>{entry.actorLabel} · {new Date(entry.at).toLocaleString()}</p>
                                {entry.matchId ? <p>Match: {entry.matchId}</p> : null}
                                {entry.detail ? <p className="break-words">{entry.detail}</p> : null}
                              </div>
                            ))}
                        </div>
                      )}
                    </SectionCard>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : null}
        </main>

        <div className="text-center text-sm font-semibold text-foreground/60">
          <Link to="/" className="text-ocean hover:underline">
            Back to all formats
          </Link>
        </div>
        <p className="text-center text-[10px] text-foreground/40">
          GSDE admin build 2026-11-19b
        </p>
      </div>
    </div>
  );
}
