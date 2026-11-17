import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  AlertCircle,
  CheckCircle2,
  GitBranch,
  Loader2,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Trash2,
  Trophy,
  Users,
  Wrench,
  Zap,
} from "lucide-react";
import {
  createPendingTeam,
  createTeamId,
  getGameLabel,
  getGameNumber,
  validateTeamDraft,
  type EliminationMatch,
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
  selectFinalResult,
  startGroupMatch,
  startGroupStage,
  verifyGroupStageCompletion,
} from "@/formats/group-double-elimination/scoring";
import {
  getRegistrations,
  getRegistrationStats,
  selectPendingRegistrations,
} from "@/formats/group-double-elimination/registration";
import {
  UNKNOWN_ADMIN,
  selectCorrections,
  type AuditActor,
} from "@/formats/group-double-elimination/audit";
import { findSubmissionForMatch } from "@/formats/group-double-elimination/playerSubmission";
import {
  canLoadTestData,
  loadTestTeamsAndPlayers,
} from "@/formats/group-double-elimination/testData";
import { getCurrentUser } from "@/utils/authUtils";
import {
  saveGsdeTournament,
  type GsdeTournamentDocument,
} from "@/formats/group-double-elimination/persistence";
import { GROUP_DOUBLE_ELIMINATION_FORMAT } from "@/formats";
import {
  PageShell,
  STATUS_LABEL,
  statusColor,
  useGsdeTournament,
} from "./shared";
import {
  EliminationStandingsView,
  GlobalRankingView,
  GroupMatchesView,
  GroupStandingsView,
  PlacementsView,
  ProgressSummary,
} from "./views";

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

const inputCls = "h-8 text-sm";

export default function GroupDoubleEliminationAdminSetup() {
  const { id, setId, doc, loading, error } = useGsdeTournament();
  const [idDraft, setIdDraft] = useState(id);
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [division, setDivision] = useState("Open");
  const [teamLimit, setTeamLimit] = useState("16");
  const [groupCount, setGroupCount] = useState("4");
  const [groupSize, setGroupSize] = useState("4");
  const [teamName, setTeamName] = useState("");
  const [teamSeed, setTeamSeed] = useState("");
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editSeed, setEditSeed] = useState("");
  const [groupScores, setGroupScores] = useState<Record<string, ScoreDraft>>({});
  const [eliminationScores, setEliminationScores] = useState<
    Record<string, EliminationDraft>
  >({});
  const [overrideConfirmed, setOverrideConfirmed] = useState(false);
  const [reopenDiscardConfirmed, setReopenDiscardConfirmed] = useState(false);
  const [reopenTarget, setReopenTarget] = useState<"elimination" | "group-stage">("elimination");
  const [regTeamChoice, setRegTeamChoice] = useState<Record<string, string>>({});
  const [actor, setActor] = useState<AuditActor>(UNKNOWN_ADMIN);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  // The admin page is behind `ProtectedRoute adminOnly`, so the signed-in user
  // is the actor recorded on every audit entry. Fall back to UNKNOWN_ADMIN if
  // identity is still resolving when an action is taken.
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

  useEffect(() => setIdDraft(id), [id]);
  useEffect(() => {
    if (!doc) return;
    const config = doc.tournament.config;
    setName(config.name);
    setDate(config.date);
    setDivision(config.divisionName);
    setTeamLimit(String(config.teamLimit));
    setGroupCount(String(config.groupCount));
    setGroupSize(String(config.teamsPerGroup ?? 4));
  }, [
    doc?.tournament.config.name,
    doc?.tournament.config.date,
    doc?.tournament.config.divisionName,
    doc?.tournament.config.teamLimit,
    doc?.tournament.config.groupCount,
    doc?.tournament.config.teamsPerGroup,
  ]); // eslint-disable-line react-hooks/exhaustive-deps

  const apply = async (
    transform: (current: GsdeTournamentDocument) => GsdeTournamentDocument,
    successText: string
  ) => {
    if (!doc) return;
    setSaving(true);
    setNotice(null);
    try {
      await saveGsdeTournament(transform(doc));
      setNotice({ kind: "ok", text: successText });
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
    const transform =
      match.status === "completed"
        ? (current: GsdeTournamentDocument) =>
            correctGroupMatchScore(current, matchId, a, b, actor)
        : (current: GsdeTournamentDocument) =>
            scoreGroupMatch(current, matchId, a, b, actor);
    apply(transform, match.status === "completed" ? "Group result corrected." : "Group score saved.");
  };

  const addTeam = () => {
    if (!doc) return;
    const seed = teamSeed.trim() === "" ? null : Number(teamSeed);
    const draft = { name: teamName, playerIds: [], seed };
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
    const transform =
      match.status === "completed"
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
    apply(transform, match.status === "completed" ? "Result corrected and bracket recalculated." : "Result saved.");
  };

  const status = doc?.tournament.status ?? "draft";
  const playableElimination = doc?.elimination
    ? [...doc.elimination.winners, ...doc.elimination.losers, ...doc.elimination.grandFinal].filter(
        (match) => match.teamAId !== null && match.teamBId !== null
      )
    : [];
  const completion = doc ? verifyGroupStageCompletion(doc) : null;
  const finalResult = doc ? selectFinalResult(doc) : null;
  const approvedCount = doc ? selectApprovedTeamCount(doc) : 0;
  const corrections = doc ? selectCorrections(doc) : [];
  const registrationStats = doc ? getRegistrationStats(doc) : null;
  const pendingRegistrations = doc ? selectPendingRegistrations(doc) : [];
  const allRegistrations = doc ? getRegistrations(doc) : [];

  return (
    <PageShell
      title="Admin setup"
      subtitle={`${GROUP_DOUBLE_ELIMINATION_FORMAT.name} · isolated tournament data`}
      backTo={`${GROUP_DOUBLE_ELIMINATION_FORMAT.route}${id !== "default" ? `?id=${encodeURIComponent(id)}` : ""}`}
      backLabel={GROUP_DOUBLE_ELIMINATION_FORMAT.shortName}
      badge={
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusColor(status)}`}
        >
          {STATUS_LABEL[status]}
        </span>
      }
    >
      {notice ? (
        <Card
          className={
            notice.kind === "ok"
              ? "border-emerald-300 bg-emerald-50"
              : "border-red-300 bg-red-50"
          }
        >
          <CardContent
            className={`flex items-center gap-2 p-3 text-sm ${
              notice.kind === "ok" ? "text-emerald-800" : "text-red-800"
            }`}
          >
            {notice.kind === "ok" ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            {notice.text}
          </CardContent>
        </Card>
      ) : null}

      {loading ? (
        <Card className="border-sand-dark/40 shadow-beach bg-card/95">
          <CardContent className="flex items-center justify-center gap-2 p-10 text-sm text-foreground/60">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading tournament…
          </CardContent>
        </Card>
      ) : error ? (
        <Card className="border-red-300 bg-red-50">
          <CardContent className="p-4 text-sm text-red-800">
            Could not load Firestore data: {error}
          </CardContent>
        </Card>
      ) : doc ? (
        <>
          <ProgressSummary doc={doc} />

          <Card className="border-sand-dark/40 shadow-beach bg-card/95">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Wrench className="h-4 w-4 text-ocean" />
                1. Tournament configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-end gap-2">
                <label className="flex-1 min-w-[180px] text-xs text-foreground/60">
                  Event id
                  <Input
                    className={`${inputCls} mt-1`}
                    value={idDraft}
                    onChange={(event) => setIdDraft(event.target.value)}
                  />
                </label>
                <Button variant="outline" size="sm" onClick={() => setId(idDraft)}>
                  Switch
                </Button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                <label className="text-xs text-foreground/60">
                  Tournament name
                  <Input className={`${inputCls} mt-1`} value={name} onChange={(e) => setName(e.target.value)} />
                </label>
                <label className="text-xs text-foreground/60">
                  Date
                  <Input className={`${inputCls} mt-1`} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                </label>
                <label className="text-xs text-foreground/60">
                  Division
                  <Input className={`${inputCls} mt-1`} value={division} onChange={(e) => setDivision(e.target.value)} />
                </label>
                <label className="text-xs text-foreground/60">
                  Team limit
                  <Input className={`${inputCls} mt-1`} type="number" min={2} value={teamLimit} onChange={(e) => setTeamLimit(e.target.value)} />
                </label>
                <label className="text-xs text-foreground/60">
                  Number of groups
                  <Input className={`${inputCls} mt-1`} type="number" min={1} value={groupCount} onChange={(e) => setGroupCount(e.target.value)} />
                </label>
                <label className="text-xs text-foreground/60">
                  Group size
                  <Input className={`${inputCls} mt-1`} type="number" min={2} value={groupSize} onChange={(e) => setGroupSize(e.target.value)} />
                </label>
              </div>
              <Button
                size="sm"
                disabled={saving}
                onClick={() =>
                  apply(
                    (current) =>
                      saveSetup(current, {
                        ...current.tournament.config,
                        name,
                        date,
                        divisionName: division,
                        teamLimit: Number(teamLimit),
                        groupCount: Number(groupCount),
                        teamsPerGroup: Number(groupSize),
                      }),
                    "Setup saved."
                  )
                }
              >
                Save setup
              </Button>
              <p className="text-xs text-foreground/50">
                This fixed format enforces 16 teams / 4 groups / group size 4 when groups are generated.
              </p>
            </CardContent>
          </Card>

          <Card className="border-sand-dark/40 shadow-beach bg-card/95">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4 text-ocean" />
                2. Team registration ({approvedCount}/{doc.teams.length} approved)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-end gap-2">
                <label className="flex-1 min-w-[160px] text-xs text-foreground/60">
                  Team name
                  <Input
                    className={`${inputCls} mt-1`}
                    value={teamName}
                    placeholder="e.g. Team Sunset"
                    onChange={(event) => setTeamName(event.target.value)}
                  />
                </label>
                <label className="w-24 text-xs text-foreground/60">
                  Seed (opt.)
                  <Input
                    className={`${inputCls} mt-1`}
                    type="number"
                    min={1}
                    value={teamSeed}
                    onChange={(event) => setTeamSeed(event.target.value)}
                  />
                </label>
                <Button size="sm" disabled={saving || doc.teams.length >= 16} onClick={addTeam}>
                  <Plus className="mr-1 h-4 w-4" />
                  Register
                </Button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {doc.teams.map((team) => {
                  const approved = team.status !== "pending";
                  return (
                    <span
                      key={team.id}
                      className="inline-flex items-center gap-1 rounded-full border border-sand-dark/30 bg-white/70 px-2 py-1 text-xs text-foreground/80"
                    >
                      {team.seed ? <b className="text-ocean">#{team.seed}</b> : null}
                      {team.name}
                      <Badge
                        variant="outline"
                        className={
                          approved
                            ? "border-emerald-300 text-emerald-700"
                            : "border-amber-300 text-amber-700"
                        }
                      >
                        {approved ? "approved" : "pending"}
                      </Badge>
                      {!approved ? (
                        <button
                          type="button"
                          aria-label={`Approve ${team.name}`}
                          className="text-emerald-600 hover:text-emerald-800"
                          disabled={saving}
                          onClick={() => apply((current) => approveTeam(current, team.id, true, actor), `${team.name} approved.`)}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        </button>
                      ) : null}
                      <button
                        type="button"
                        aria-label={`Edit ${team.name}`}
                        className="text-ocean hover:text-ocean-dark"
                        disabled={saving || doc.matches.length > 0}
                        onClick={() => {
                          setEditingTeamId(team.id);
                          setEditName(team.name);
                          setEditSeed(team.seed === null ? "" : String(team.seed));
                        }}
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Remove ${team.name}`}
                        className="text-foreground/40 hover:text-red-600"
                        disabled={saving || doc.matches.length > 0}
                        onClick={() =>
                          apply(
                            (current) => removeTeam(current, team.id, actor),
                            `${team.name} removed.`
                          )
                        }
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </span>
                  );
                })}
              </div>
              {editingTeamId ? (
                <div className="flex flex-wrap items-end gap-2 rounded-xl border border-ocean/30 bg-ocean/5 p-2">
                  <label className="flex-1 min-w-[140px] text-xs text-foreground/60">
                    Name
                    <Input className={`${inputCls} mt-1`} value={editName} onChange={(e) => setEditName(e.target.value)} />
                  </label>
                  <label className="w-24 text-xs text-foreground/60">
                    Seed
                    <Input className={`${inputCls} mt-1`} type="number" min={1} value={editSeed} onChange={(e) => setEditSeed(e.target.value)} />
                  </label>
                  <Button size="sm" disabled={saving} onClick={saveTeamEdit}>Save team</Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingTeamId(null)}>Cancel</Button>
                </div>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={saving || !canLoadTestData(doc)}
                  onClick={() =>
                    apply(
                      (current) => loadTestTeamsAndPlayers(current, actor),
                      "16 approved test teams and players loaded; group schedule generated."
                    )
                  }
                >
                  <Zap className="mr-1 h-4 w-4" />
                  Load test teams &amp; players
                </Button>
                <Button
                  size="sm"
                  disabled={saving || approvedCount !== 16}
                  onClick={() =>
                    apply(
                      (current) => buildTeamsAndGroups(current, current.teams, actor),
                      "4 groups and 24 matches generated."
                    )
                  }
                >
                  Build groups &amp; schedule
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={saving || doc.matches.length !== 24 || status !== "configured"}
                  onClick={() => apply((current) => startGroupStage(current, actor), "Group stage started.")}
                >
                  Start group stage
                </Button>
              </div>
              {approvedCount !== 16 ? (
                <p className="text-xs text-amber-700">
                  Register and approve exactly 16 teams to generate the fixed groups.
                </p>
              ) : null}
              <p className="text-xs text-foreground/55">
                Test data creates approved placeholder teams and players (like King &amp;
                Queen) only inside this tournament. The first three test accounts can
                sign in and submit scores immediately.
              </p>
            </CardContent>
          </Card>

          <Card className="border-ocean/20 bg-ocean/5 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4 text-ocean" />
                3. Player registrations ({registrationStats?.pending ?? 0} pending ·{" "}
                {registrationStats?.approved ?? 0} approved)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-foreground/60">
                Players register themselves at the public registration page. Approve each
                player and assign them to a team; their team's <code>playerIds</code> is
                filled automatically. Every decision is written to the audit log.
              </p>
              {allRegistrations.length === 0 ? (
                <p className="text-sm text-foreground/60">
                  No players have registered yet. Share the registration page with players.
                </p>
              ) : (
                <div className="space-y-2">
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
                    return (
                      <div
                        key={registration.uid}
                        className="flex flex-wrap items-center gap-2 rounded-lg border border-sand-dark/25 bg-white/70 p-2 text-xs"
                      >
                        <span className="font-semibold text-foreground/85">{registration.name}</span>
                        <span className="text-foreground/55">{registration.email}</span>
                        <Badge
                          variant="outline"
                          className={
                            registration.status === "approved"
                              ? "border-emerald-300 text-emerald-700"
                              : registration.status === "rejected"
                                ? "border-red-300 text-red-700"
                                : "border-amber-300 text-amber-700"
                          }
                        >
                          {registration.status}
                        </Badge>
                        {teamName ? <span className="text-foreground/60">· {teamName}</span> : null}
                        {registration.status !== "approved" ? (
                          <>
                            <select
                              aria-label={`Assign ${registration.name} to a team`}
                              className="h-8 rounded-md border border-sand-dark/40 bg-white px-2 text-xs"
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
                                  <option key={team.id} value={team.id}>
                                    {team.name}
                                  </option>
                                ))
                              )}
                            </select>
                            <Button
                              size="sm"
                              disabled={saving || doc.teams.length === 0 || !choice}
                              onClick={() =>
                                apply(
                                  (current) =>
                                    approvePlayerRegistration(current, registration.uid, choice, actor),
                                  `${registration.name} approved and assigned.`
                                )
                              }
                            >
                              <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Approve
                            </Button>
                          </>
                        ) : null}
                        {registration.status !== "rejected" ? (
                          <Button
                            size="sm"
                            variant="outline"
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
                        <button
                          type="button"
                          aria-label={`Remove ${registration.name}'s registration`}
                          className="text-foreground/40 hover:text-red-600 disabled:opacity-40"
                          disabled={saving}
                          onClick={() =>
                            apply(
                              (current) => removePlayerRegistration(current, registration.uid, actor),
                              `${registration.name}'s registration was removed.`
                            )
                          }
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
              {doc.teams.length === 0 ? (
                <p className="text-xs text-amber-700">
                  Add teams in section 2 before approving players.
                </p>
              ) : null}
            </CardContent>
          </Card>

          {doc.matches.length > 0 ? (
            <Card className="border-sand-dark/40 shadow-beach bg-card/95">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">4. Group-stage management (24 matches)</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2 p-3 sm:grid-cols-2">
                {doc.matches.map((match) => {
                  const a = groupValue(match.id, "a", match.scoreA);
                  const b = groupValue(match.id, "b", match.scoreB);
                  const complete = match.status === "completed";
                  const submission = findSubmissionForMatch(doc, match.id);
                  return (
                    <div key={match.id} className="rounded-lg border border-sand-dark/25 bg-white/60 p-2">
                      <div className="mb-1 flex items-center justify-between gap-1 text-[11px] text-foreground/50">
                        <span>{match.id}</span>
                        <span className="flex items-center gap-1">
                          {submission ? (
                            <span className="rounded bg-sky-100 px-1 text-sky-800">
                              by {submission.playerLabel}
                            </span>
                          ) : null}
                          <span className="capitalize">{match.status}</span>
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Input className="h-7 w-14 text-sm" type="number" min={0} value={a} onChange={(e) => setGroupValue(match.id, "a", e.target.value)} />
                        <span className="flex-1 truncate text-xs text-foreground/70">
                          {doc.teams.find((team) => team.id === match.teamAId)?.name ?? match.teamAId}
                        </span>
                        <span className="text-xs text-foreground/40">vs</span>
                        <span className="flex-1 truncate text-xs text-foreground/70">
                          {doc.teams.find((team) => team.id === match.teamBId)?.name ?? match.teamBId}
                        </span>
                        <Input className="h-7 w-14 text-sm" type="number" min={0} value={b} onChange={(e) => setGroupValue(match.id, "b", e.target.value)} />
                        {match.status === "pending" ? (
                          <Button size="sm" variant="outline" disabled={saving} onClick={() => apply((current) => startGroupMatch(current, match.id, actor), "Match started.")}>
                            <Play className="h-3.5 w-3.5" />
                          </Button>
                        ) : null}
                        <Button size="sm" variant={complete ? "outline" : "default"} disabled={saving} onClick={() => submitGroupScore(match.id)}>
                          {complete ? "Fix" : "Save"}
                        </Button>
                        {complete ? (
                          <Button size="sm" variant="ghost" disabled={saving} onClick={() => apply((current) => resetGroupMatch(current, match.id, actor), "Result cleared.")}>
                            <RotateCcw className="h-3.5 w-3.5" />
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ) : null}

          <Card className="border-sand-dark/40 shadow-beach bg-card/95">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Trophy className="h-4 w-4 text-ocean" />
                5. Group-stage completion
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-foreground/75">
                {completion
                  ? `${completion.completed}/${completion.total} group matches complete`
                  : "No group stage generated yet."}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  disabled={saving || !completion?.isComplete}
                  onClick={() => apply((current) => completeGroupStage(current, actor), "Group stage verified and final ranking calculated.")}
                >
                  Verify &amp; complete
                </Button>
                {doc.tournament.groupStageVerified ? (
                  <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Verified</Badge>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <Card className="border-sand-dark/40 shadow-beach bg-card/95">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <GitBranch className="h-4 w-4 text-ocean" />
                6. Elimination bracket generation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  disabled={saving || !completion?.isComplete}
                  onClick={() => apply((current) => generateEliminationBracket(current, {}, actor), "Spanish bracket generated.")}
                >
                  Generate bracket
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={saving || !doc.elimination}
                  onClick={() => apply((current) => resetEliminationBracket(current, actor), "Unstarted bracket reset.")}
                >
                  <RotateCcw className="mr-1 h-4 w-4" />
                  Reset bracket
                </Button>
                {doc.tournament.seedingStale ? (
                  <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Seeding changed — regenerate</Badge>
                ) : null}
              </div>
              <label className="flex items-center gap-2 text-xs text-foreground/70">
                <input
                  type="checkbox"
                  checked={overrideConfirmed}
                  onChange={(e) => setOverrideConfirmed(e.target.checked)}
                />
                Admin override: I confirm the bracket is provisional while group matches are incomplete.
              </label>
              <Button
                size="sm"
                variant="outline"
                disabled={saving || !overrideConfirmed || Boolean(completion?.isComplete)}
                onClick={() =>
                  apply(
                    (current) => generateEliminationBracket(current, { overrideIncomplete: true, adminConfirmed: true }, actor),
                    "Provisional bracket generated from partial standings."
                  )
                }
              >
                Generate with override
              </Button>
            </CardContent>
          </Card>

          {finalResult?.complete ? (
            <Card className="border-amber-300/60 bg-amber-50/70 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2 text-amber-900">
                  <Trophy className="h-4 w-4" /> 8. Tournament complete
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-amber-900">
                <p>
                  <strong>Champion:</strong>{" "}
                  {finalResult.championTeamIds
                    .map((teamId) => doc.teams.find((team) => team.id === teamId)?.name ?? teamId)
                    .join(" / ")}
                </p>
                <p>
                  <strong>Runner-up:</strong>{" "}
                  {finalResult.runnerUpTeamIds
                    .map((teamId) => doc.teams.find((team) => team.id === teamId)?.name ?? teamId)
                    .join(" / ")}
                </p>
              </CardContent>
            </Card>
          ) : null}

          {finalResult?.complete ? (
            <Card className="border-sand-dark/40 shadow-beach bg-card/95">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <RotateCcw className="h-4 w-4 text-ocean" />
                  9. Reopen completed tournament (admin only)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-xs text-foreground/65">
                  Reopening discards results from the chosen stage onward and is recorded in the
                  audit log. Only an authorized admin may do this.
                </p>
                <div className="flex flex-wrap items-end gap-2">
                  <label className="text-xs text-foreground/60">
                    Reopen to stage
                    <select
                      className="mt-1 h-8 rounded-md border border-sand-dark/40 bg-white px-2 text-sm"
                      value={reopenTarget}
                      onChange={(event) =>
                        setReopenTarget(event.target.value as "elimination" | "group-stage")
                      }
                    >
                      <option value="elimination">Double elimination (keep group results)</option>
                      <option value="group-stage">Group stage (also discard bracket)</option>
                    </select>
                  </label>
                  <label className="flex items-center gap-2 text-xs text-foreground/70">
                    <input
                      type="checkbox"
                      checked={reopenDiscardConfirmed}
                      onChange={(event) => setReopenDiscardConfirmed(event.target.checked)}
                    />
                    I confirm later-stage results will be discarded.
                  </label>
                  <Button
                    size="sm"
                    variant="outline"
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
                    Reopen tournament
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}

          <Card className="border-sand-dark/40 shadow-beach bg-card/95">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Wrench className="h-4 w-4 text-ocean" />
                10. Audit log — corrections &amp; reopenings ({corrections.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {corrections.length === 0 ? (
                <p className="text-sm text-foreground/60">
                  No corrections or reopenings have been recorded yet.
                </p>
              ) : (
                [...corrections]
                  .reverse()
                  .slice(0, 50)
                  .map((entry) => (
                    <div
                      key={entry.id}
                      className="rounded-lg border border-sand-dark/25 bg-white/60 px-2.5 py-1.5 text-xs text-foreground/75"
                    >
                      <span className="font-semibold text-ocean">{entry.action}</span>
                      {" · "}
                      <span>{entry.actorLabel}</span>
                      {" · "}
                      <time>{new Date(entry.at).toLocaleString()}</time>
                      {entry.matchId ? ` · ${entry.matchId}` : ""}
                      {entry.detail ? ` — ${entry.detail}` : ""}
                    </div>
                  ))
              )}
            </CardContent>
          </Card>

          {playableElimination.length > 0 ? (
            <Card className="border-sand-dark/40 shadow-beach bg-card/95">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">7. Elimination scores &amp; corrections</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2 p-3 lg:grid-cols-2">
                {playableElimination.map((match) => {
                  const draft = elValue(match);
                  const gameNumber = getGameNumber(match.id);
                  const submission = findSubmissionForMatch(doc, match.id);
                  return (
                    <div key={match.id} className="rounded-lg border border-sand-dark/25 bg-white/60 p-2">
                      <div className="mb-1.5 flex items-center justify-between gap-1 text-[11px] text-foreground/50">
                        <span className="font-semibold text-ocean">
                          {gameNumber === null ? match.id : getGameLabel(match.id)}
                        </span>
                        <span className="flex items-center gap-1">
                          {submission ? (
                            <span className="rounded bg-sky-100 px-1 text-sky-800">
                              by {submission.playerLabel}
                            </span>
                          ) : null}
                          <span>
                            {match.phase === "grand-final" ? "Grand Final" : match.phase} R{match.round}
                          </span>
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <select
                          className="h-7 rounded-md border border-sand-dark/40 bg-white px-1 text-xs"
                          value={draft.winner}
                          onChange={(event) => setElValue(match.id, { winner: event.target.value as "A" | "B" })}
                        >
                          <option value="A">Winner: {doc.teams.find((t) => t.id === match.teamAId)?.name ?? "A"}</option>
                          <option value="B">Winner: {doc.teams.find((t) => t.id === match.teamBId)?.name ?? "B"}</option>
                        </select>
                        <Input className="h-7 w-14 text-sm" type="number" min={0} value={draft.a} onChange={(e) => setElValue(match.id, { a: e.target.value })} />
                        <span className="text-xs text-foreground/40">:</span>
                        <Input className="h-7 w-14 text-sm" type="number" min={0} value={draft.b} onChange={(e) => setElValue(match.id, { b: e.target.value })} />
                        <Button size="sm" variant={match.status === "completed" ? "outline" : "default"} disabled={saving} onClick={() => submitEliminationScore(match)}>
                          {match.status === "completed" ? "Fix" : "Save"}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ) : null}

          <div className="space-y-6">
            <GroupStandingsView doc={doc} />
            <GlobalRankingView doc={doc} />
            <GroupMatchesView doc={doc} />
            <EliminationStandingsView doc={doc} />
            <PlacementsView doc={doc} />
          </div>

          <p className="text-center text-xs text-foreground/50">
            This page only reads and writes{" "}
            <code className="rounded bg-white/70 px-1 py-0.5">tournaments/{`{id}`}</code>.
            King &amp; Queen data is never touched.
          </p>
        </>
      ) : null}

      <div className="text-center text-sm text-foreground/60">
        <Link to="/" className="font-semibold text-foreground/80 hover:underline">
          Back to all formats
        </Link>
      </div>
    </PageShell>
  );
}
