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
  validateTeamDraft,
  type EliminationMatch,
  type TournamentCategory,
} from "@/formats/group-double-elimination";
import {
  addTeam as addGsdeTeam,
  approvePlayerRegistration,
  approveTeam,
  buildTeamsAndGroups,
  completeGroupStage,
  correctEliminationResult,
  correctGroupMatchScore,
  editTeam,
  generateEliminationBracket,
  rejectPlayerRegistration,
  removePlayerRegistration,
  reopenTournament,
  removeTeam,
  resetEliminationBracket,
  resetGroupMatch,
  saveSetup,
  scoreEliminationMatch,
  scoreGroupMatch,
  selectApprovedTeamCount,
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
  getRegistrations,
  getRegistrationStats,
} from "@/formats/group-double-elimination/registration";
import {
  UNKNOWN_ADMIN,
  selectCorrections,
  type AuditActor,
} from "@/formats/group-double-elimination/audit";
import { findSubmissionForMatch } from "@/formats/group-double-elimination/playerSubmission";
import {
  canLoadTestData,
  GROUP_COUNT_BY_TEAM_COUNT,
  loadTestTeamsAndPlayers,
  SUPPORTED_TEST_TEAM_COUNTS,
  type TestTeamCount,
} from "@/formats/group-double-elimination/testData";
import {
  getTeamPlayerNames,
  normalizeTournamentCategory,
  TOURNAMENT_CATEGORY_OPTIONS,
} from "@/formats/group-double-elimination/category";
import { getCurrentUser } from "@/utils/authUtils";
import {
  saveGsdeTournament,
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

interface EliminationDraft extends ScoreDraft {
  winner: "A" | "B";
}

type AdminSection =
  | "overview"
  | "teams"
  | "players"
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
  const [manageSection, setManageSection] = useState<ManageSection>("flow");
  const [resultsSection, setResultsSection] = useState<ResultsSection>("groups");
  const [matchStage, setMatchStage] = useState<MatchStage>("group");
  const [groupMatchIndex, setGroupMatchIndex] = useState(0);
  const [eliminationMatchIndex, setEliminationMatchIndex] = useState(0);
  const [overrideConfirmed, setOverrideConfirmed] = useState(false);
  const [reopenDiscardConfirmed, setReopenDiscardConfirmed] = useState(false);
  const [reopenTarget, setReopenTarget] = useState<"elimination" | "group-stage">("elimination");
  const [regTeamChoice, setRegTeamChoice] = useState<Record<string, string>>({});
  const [actor, setActor] = useState<AuditActor>(UNKNOWN_ADMIN);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

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
  }, [id]);

  useEffect(() => {
    setName(doc?.tournament.config.name ?? "");
    setDate(doc?.tournament.config.date ?? "");
    setDivision(doc?.tournament.config.divisionName ?? "Open");
    setCategory(normalizeTournamentCategory(doc?.tournament.config.category));
    setTeamLimit(String(doc?.tournament.config.teamLimit ?? 16));
    setGroupCount(String(doc?.tournament.config.groupCount ?? 4));
    setGroupSize(String(doc?.tournament.config.teamsPerGroup ?? 4));
  }, [
    doc?.tournament.config.name,
    doc?.tournament.config.date,
    doc?.tournament.config.divisionName,
    doc?.tournament.config.category,
    doc?.tournament.config.teamLimit,
    doc?.tournament.config.groupCount,
    doc?.tournament.config.teamsPerGroup,
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
  const groupMatches = doc?.matches ?? [];
  const playableElimination = doc?.elimination
    ? [...doc.elimination.winners, ...doc.elimination.losers, ...doc.elimination.grandFinal].filter(
        (match) => match.teamAId !== null && match.teamBId !== null
      )
    : [];
  const eliminationDone = playableElimination.filter(
    (match) => match.status === "completed"
  ).length;
  const completion = doc ? verifyGroupStageCompletion(doc) : null;
  const finalResult = doc ? selectFinalResult(doc) : null;
  const approvedCount = doc ? selectApprovedTeamCount(doc) : 0;
  const corrections = doc ? selectCorrections(doc) : [];
  const registrationStats = doc ? getRegistrationStats(doc) : null;
  const allRegistrations = doc ? getRegistrations(doc) : [];
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

  const showError = (text: string) => setNotice({ kind: "error", text });

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

  const elValue = (match: EliminationMatch): EliminationDraft => {
    const stored = eliminationScores[match.id];
    if (stored) return stored;
    return {
      winner: match.winnerId === match.teamBId ? "B" : "A",
      a: match.scoreA === null ? "" : String(match.scoreA),
      b: match.scoreB === null ? "" : String(match.scoreB),
    };
  };

  const setElValue = (matchId: string, patch: Partial<EliminationDraft>) =>
    setEliminationScores((previous) => {
      const base = previous[matchId] ?? { winner: "A" as const, a: "", b: "" };
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
      [match.id]: {
        winner: match.winnerId === match.teamBId ? "B" : "A",
        a: match.scoreA === null ? "" : String(match.scoreA),
        b: match.scoreB === null ? "" : String(match.scoreB),
      },
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
    const draft = elValue(match);
    if (draft.a.trim() === "" || draft.b.trim() === "") {
      showError("Enter both scores.");
      return;
    }
    const winnerId = draft.winner === "A" ? match.teamAId : match.teamBId;
    const loserId = draft.winner === "A" ? match.teamBId : match.teamAId;
    if (!winnerId || !loserId) {
      showError("Both teams must be known before scoring.");
      return;
    }
    const a = Number(draft.a);
    const b = Number(draft.b);
    const wasComplete = match.status === "completed";
    const transform =
      wasComplete
        ? (current: GsdeTournamentDocument) =>
            correctEliminationResult(
              current,
              match.id,
              { winnerId, loserId, scoreA: a, scoreB: b },
              actor
            )
        : (current: GsdeTournamentDocument) =>
            scoreEliminationMatch(
              current,
              { matchId: match.id, winnerId, loserId, scoreA: a, scoreB: b },
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
                  : !finalResult?.complete
                    ? "Bracket is complete — check Results."
                    : "Tournament complete — results are in Results.";

  const sectionOptions: ReadonlyArray<{ key: AdminSection; label: string }> = [
    { key: "overview", label: "🏠 Overview" },
    { key: "teams", label: "👥 Teams" },
    { key: "players", label: "🙋 Players" },
    { key: "matches", label: "🏐 Matches" },
    { key: "results", label: "🏆 Results" },
    { key: "manage", label: "⚙️ Manage" },
  ];

  const quickLinks: ReadonlyArray<{ key: AdminSection; label: string }> = [
    { key: "teams", label: "👥 Teams" },
    { key: "players", label: "🙋 Players" },
    { key: "matches", label: "🏐 Enter scores" },
    { key: "results", label: "🏆 Results" },
    { key: "manage", label: "⚙️ Tournament controls" },
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
                                apply(
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
                <SectionCard
                  emoji="🙋"
                  title="Player registrations"
                  gradient="sunset"
                >
                  <p className="text-center text-sm text-foreground/65">
                    {registrationStats?.pending ?? 0} pending ·{" "}
                    {registrationStats?.approved ?? 0} approved
                  </p>
                  <p className="text-center text-xs text-foreground/55">
                    Players register themselves at the public registration page. Approve each player
                    and assign them to a team. Every decision is saved to the activity log.
                  </p>
                  {allRegistrations.length === 0 ? (
                    <p className="rounded-xl bg-sand-light/50 p-4 text-center text-sm font-semibold text-foreground/60">
                      No players have registered yet. Share the registration page with players.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {allRegistrations.map((registration) => {
                        const teamName = registration.teamId
                          ? doc.teams.find((team) => team.id === registration.teamId)?.name ??
                            registration.teamId
                          : null;
                        const choice =
                          regTeamChoice[registration.uid] ??
                          registration.teamId ??
                          doc.teams[0]?.id ??
                          "";
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
                                  {registration.gender
                                    ? registration.gender === "male"
                                      ? "Male"
                                      : "Female"
                                    : "Gender not supplied"}
                                </p>
                              </div>
                              <Pill tone={tone}>{registration.status}</Pill>
                            </div>
                            {teamName ? (
                              <p className="text-sm text-foreground/60">
                                Team: <span className="font-bold">{teamName}</span>
                              </p>
                            ) : null}
                            {registration.status !== "approved" ? (
                              <Field label="Assign to team">
                                <select
                                  aria-label={`Assign ${registration.name} to a team`}
                                  className={selectCls}
                                  value={choice}
                                  disabled={saving || doc.teams.length === 0}
                                  onChange={(event) =>
                                    setRegTeamChoice((previous) => ({
                                      ...previous,
                                      [registration.uid]: event.target.value,
                                    }))
                                  }
                                >
                                  {doc.teams.length === 0 ? (
                                    <option value="">No teams yet</option>
                                  ) : (
                                    doc.teams.map((team) => (
                                      <option
                                        key={team.id}
                                        value={team.id}
                                        disabled={
                                          !team.playerIds.includes(registration.uid) &&
                                          team.playerIds.length >= 2
                                        }
                                      >
                                        {names.get(team.id) ?? team.name}
                                        {team.playerIds.length >= 2 ? " (full)" : ""}
                                      </option>
                                    ))
                                  )}
                                </select>
                              </Field>
                            ) : null}
                            <div className="flex flex-wrap gap-2">
                              {registration.status !== "approved" ? (
                                <Button
                                  className="flex-1 touch-target bg-palm hover:bg-palm-dark text-white font-semibold py-3"
                                  disabled={saving || doc.teams.length === 0 || !choice}
                                  onClick={() =>
                                    apply(
                                      (current) =>
                                        approvePlayerRegistration(current, registration.uid, choice, actor),
                                      `${registration.name} approved and assigned.`
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
                                    apply(
                                      (current) => rejectPlayerRegistration(current, registration.uid, actor),
                                      `${registration.name}'s registration was rejected.`
                                    )
                                  }
                                >
                                  Reject
                                </Button>
                              ) : null}
                              <Button
                                className="flex-1 touch-target bg-white/70 border-sand-dark/30 text-foreground/60 font-semibold py-3"
                                disabled={saving}
                                onClick={() =>
                                  apply(
                                    (current) => removePlayerRegistration(current, registration.uid, actor),
                                    `${registration.name}'s registration was removed.`
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
                  {doc.teams.length === 0 ? (
                    <p className="text-center text-xs font-semibold text-amber-800">
                      Add teams in the Teams section before approving players.
                    </p>
                  ) : null}
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
                                        onClick={() =>
                                          apply(
                                            (current) => resetGroupMatch(current, match.id, actor),
                                            "Result cleared."
                                          )
                                        }
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
                                    value={draft.a}
                                    onChange={(e) => setElValue(match.id, { a: e.target.value })}
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
                                    value={draft.b}
                                    onChange={(e) => setElValue(match.id, { b: e.target.value })}
                                    placeholder="0"
                                  />
                                )}
                              </div>

                              {complete && !editing ? (
                                <div className="text-center">
                                  <Pill tone="palm">
                                    👑 {nameOf(names, match.winnerId)} won {match.scoreA} - {match.scoreB}
                                  </Pill>
                                </div>
                              ) : (
                                <div className="grid grid-cols-2 gap-2">
                                  <button
                                    type="button"
                                    disabled={saving}
                                    onClick={() => setElValue(match.id, { winner: "A" })}
                                    className={`touch-target rounded-xl px-2 py-3 text-sm font-bold transition-all ${
                                      draft.winner === "A"
                                        ? "bg-ocean text-white shadow-beach"
                                        : "border border-ocean/30 bg-ocean/10 text-ocean-dark"
                                    }`}
                                  >
                                    👑 {teamA} wins
                                  </button>
                                  <button
                                    type="button"
                                    disabled={saving}
                                    onClick={() => setElValue(match.id, { winner: "B" })}
                                    className={`touch-target rounded-xl px-2 py-3 text-sm font-bold transition-all ${
                                      draft.winner === "B"
                                        ? "bg-sunset text-white shadow-beach"
                                        : "border border-sunset/30 bg-sunset/10 text-sunset-dark"
                                    }`}
                                  >
                                    👑 {teamB} wins
                                  </button>
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
                                      detail={`${row.wins}W · ${row.losses}L`}
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
                  ) : null}

                  {manageSection === "flow" ? (
                    <SectionCard emoji="▶️" title="Tournament flow">
                      <div className="space-y-3">
                        <Button
                          className={primaryBtn}
                          disabled={saving || !canLoadTestData(doc)}
                          onClick={() =>
                            apply(
                              (current) => loadTestTeamsAndPlayers(current, actor),
                              `${selectedTeamCount} approved ${category} pairs and ${expectedPlayers} players loaded; group schedule generated.`
                            )
                          }
                        >
                          <Zap className="w-5 h-5 mr-2" />
                          Load test teams &amp; players
                        </Button>
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
                        Test data creates approved placeholder teams and players only inside this tournament.
                        The first three test accounts can sign in and submit scores immediately.
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
                              "Spanish bracket generated."
                            )
                          }
                        >
                          Generate bracket
                        </Button>
                        <Button
                          className={outlineBtn}
                          disabled={saving || !doc.elimination}
                          onClick={() =>
                            apply(
                              (current) => resetEliminationBracket(current, actor),
                              "Unstarted bracket reset."
                            )
                          }
                        >
                          <RotateCcw className="w-5 h-5 mr-2" />
                          Reset bracket
                        </Button>
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
      </div>
    </div>
  );
}
