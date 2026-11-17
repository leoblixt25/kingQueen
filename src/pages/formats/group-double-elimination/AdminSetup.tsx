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
  Plus,
  RotateCcw,
  Trash2,
  Users,
  Wrench,
} from "lucide-react";
import {
  createTeam,
  createTeamId,
  getGameLabel,
  getGameNumber,
  validateTeamDraft,
  type EliminationMatch,
} from "@/formats/group-double-elimination";
import {
  buildTeamsAndGroups,
  correctEliminationResult,
  correctGroupMatchScore,
  generateEliminationBracket,
  resetEliminationBracket,
  saveSetup,
  scoreEliminationMatch,
  scoreGroupMatch,
  startGroupStage,
} from "@/formats/group-double-elimination/scoring";
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
  const [division, setDivision] = useState("Open");
  const [teamName, setTeamName] = useState("");
  const [teamSeed, setTeamSeed] = useState("");
  const [groupScores, setGroupScores] = useState<Record<string, ScoreDraft>>({});
  const [eliminationScores, setEliminationScores] = useState<
    Record<string, EliminationDraft>
  >({});
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => setIdDraft(id), [id]);
  useEffect(() => {
    if (!doc) return;
    setName(doc.tournament.config.name);
    setDivision(doc.tournament.config.divisionName);
  }, [doc?.tournament.config.name, doc?.tournament.config.divisionName]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const setElValue = (
    matchId: string,
    patch: Partial<EliminationDraft>
  ) =>
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
            correctGroupMatchScore(current, matchId, a, b)
        : (current: GsdeTournamentDocument) =>
            scoreGroupMatch(current, matchId, a, b);
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
    const team = createTeam(createTeamId(teamName), draft, null);
    apply(
      (current) => ({
        ...current,
        teams: [...current.teams, team],
      }),
      `${team.name} added.`
    );
    setTeamName("");
    setTeamSeed("");
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
            correctEliminationResult(current, match.id, {
              winnerId,
              loserId,
              scoreA: a,
              scoreB: b,
            })
        : (current: GsdeTournamentDocument) =>
            scoreEliminationMatch(current, {
              matchId: match.id,
              winnerId,
              loserId,
              scoreA: a,
              scoreB: b,
            });
    apply(transform, match.status === "completed" ? "Result corrected and bracket recalculated." : "Result saved.");
  };

  const status = doc?.tournament.status ?? "draft";
  const playableElimination = doc?.elimination
    ? [...doc.elimination.winners, ...doc.elimination.losers, ...doc.elimination.grandFinal].filter(
        (match) => match.teamAId !== null && match.teamBId !== null
      )
    : [];

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
                Tournament &amp; event
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
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="text-xs text-foreground/60">
                  Tournament name
                  <Input
                    className={`${inputCls} mt-1`}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                  />
                </label>
                <label className="text-xs text-foreground/60">
                  Division
                  <Input
                    className={`${inputCls} mt-1`}
                    value={division}
                    onChange={(event) => setDivision(event.target.value)}
                  />
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
                        divisionName: division,
                      }),
                    "Setup saved."
                  )
                }
              >
                Save setup
              </Button>
            </CardContent>
          </Card>

          <Card className="border-sand-dark/40 shadow-beach bg-card/95">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4 text-ocean" />
                Teams ({doc.teams.length}/16)
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
                <Button
                  size="sm"
                  disabled={saving || doc.teams.length >= 16}
                  onClick={addTeam}
                >
                  <Plus className="mr-1 h-4 w-4" />
                  Add
                </Button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {doc.teams.map((team) => (
                  <span
                    key={team.id}
                    className="inline-flex items-center gap-1 rounded-full border border-sand-dark/30 bg-white/70 px-2 py-1 text-xs text-foreground/80"
                  >
                    {team.seed ? <b className="text-ocean">#{team.seed}</b> : null}
                    {team.name}
                    <button
                      type="button"
                      aria-label={`Remove ${team.name}`}
                      className="text-foreground/40 hover:text-red-600"
                      disabled={saving || doc.matches.length > 0}
                      onClick={() =>
                        apply(
                          (current) => ({
                            ...current,
                            teams: current.teams.filter((item) => item.id !== team.id),
                          }),
                          `${team.name} removed.`
                        )
                      }
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  disabled={saving || doc.teams.length !== 16}
                  onClick={() =>
                    apply(
                      (current) => buildTeamsAndGroups(current, current.teams),
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
                  onClick={() => apply(startGroupStage, "Group stage started.")}
                >
                  Start group stage
                </Button>
              </div>
              {doc.teams.length !== 16 ? (
                <p className="text-xs text-amber-700">
                  Add exactly 16 teams to generate the fixed groups and schedule.
                </p>
              ) : null}
            </CardContent>
          </Card>

          {doc.matches.length > 0 ? (
            <Card className="border-sand-dark/40 shadow-beach bg-card/95">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Group scores (24 matches)</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2 p-3 sm:grid-cols-2">
                {doc.matches.map((match) => {
                  const a = groupValue(match.id, "a", match.scoreA);
                  const b = groupValue(match.id, "b", match.scoreB);
                  const complete = match.status === "completed";
                  return (
                    <div
                      key={match.id}
                      className="rounded-lg border border-sand-dark/25 bg-white/60 p-2"
                    >
                      <div className="mb-1 flex items-center justify-between text-[11px] text-foreground/50">
                        <span>{match.id}</span>
                        {complete ? <Badge variant="outline">Done</Badge> : null}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Input
                          className="h-7 w-14 text-sm"
                          type="number"
                          min={0}
                          value={a}
                          onChange={(event) => setGroupValue(match.id, "a", event.target.value)}
                        />
                        <span className="flex-1 truncate text-xs text-foreground/70">
                          {doc.teams.find((team) => team.id === match.teamAId)?.name ?? match.teamAId}
                        </span>
                        <span className="text-xs text-foreground/40">vs</span>
                        <span className="flex-1 truncate text-xs text-foreground/70">
                          {doc.teams.find((team) => team.id === match.teamBId)?.name ?? match.teamBId}
                        </span>
                        <Input
                          className="h-7 w-14 text-sm"
                          type="number"
                          min={0}
                          value={b}
                          onChange={(event) => setGroupValue(match.id, "b", event.target.value)}
                        />
                        <Button
                          size="sm"
                          variant={complete ? "outline" : "default"}
                          disabled={saving}
                          onClick={() => submitGroupScore(match.id)}
                        >
                          {complete ? "Fix" : "Save"}
                        </Button>
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
                <GitBranch className="h-4 w-4 text-ocean" />
                Bracket generation
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                disabled={saving || !doc.matches.every((match) => match.status === "completed")}
                onClick={() =>
                  apply(generateEliminationBracket, "Spanish bracket generated.")
                }
              >
                Generate bracket
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={saving || !doc.elimination}
                onClick={() =>
                  apply(resetEliminationBracket, "Unstarted bracket reset.")
                }
              >
                <RotateCcw className="mr-1 h-4 w-4" />
                Reset bracket
              </Button>
              {doc.tournament.seedingStale ? (
                <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
                  Seeding changed — regenerate
                </Badge>
              ) : null}
              <span className="text-xs text-foreground/55">
                All 24 group matches must be scored before the bracket can be generated.
              </span>
            </CardContent>
          </Card>

          {playableElimination.length > 0 ? (
            <Card className="border-sand-dark/40 shadow-beach bg-card/95">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Elimination scores &amp; corrections</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2 p-3 lg:grid-cols-2">
                {playableElimination.map((match) => {
                  const draft = elValue(match);
                  const gameNumber = getGameNumber(match.id);
                  return (
                    <div
                      key={match.id}
                      className="rounded-lg border border-sand-dark/25 bg-white/60 p-2"
                    >
                      <div className="mb-1.5 flex items-center justify-between text-[11px] text-foreground/50">
                        <span className="font-semibold text-ocean">
                          {gameNumber === null ? match.id : getGameLabel(match.id)}
                        </span>
                        <span>
                          {match.phase === "grand-final" ? "Grand Final" : match.phase} R{match.round}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <select
                          className="h-7 rounded-md border border-sand-dark/40 bg-white px-1 text-xs"
                          value={draft.winner}
                          onChange={(event) =>
                            setElValue(match.id, {
                              winner: event.target.value as "A" | "B",
                            })
                          }
                        >
                          <option value="A">
                            Winner: {doc.teams.find((t) => t.id === match.teamAId)?.name ?? "A"}
                          </option>
                          <option value="B">
                            Winner: {doc.teams.find((t) => t.id === match.teamBId)?.name ?? "B"}
                          </option>
                        </select>
                        <Input
                          className="h-7 w-14 text-sm"
                          type="number"
                          min={0}
                          value={draft.a}
                          onChange={(event) => setElValue(match.id, { a: event.target.value })}
                        />
                        <span className="text-xs text-foreground/40">:</span>
                        <Input
                          className="h-7 w-14 text-sm"
                          type="number"
                          min={0}
                          value={draft.b}
                          onChange={(event) => setElValue(match.id, { b: event.target.value })}
                        />
                        <Button
                          size="sm"
                          variant={match.status === "completed" ? "outline" : "default"}
                          disabled={saving}
                          onClick={() => submitEliminationScore(match)}
                        >
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
