import { useMemo, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Crown,
  GitBranch,
  Layers,
  Loader2,
  MapPin,
  Send,
  ShieldAlert,
  Swords,
  Trophy,
  Users,
  XCircle,
} from "lucide-react";
import { GROUP_DOUBLE_ELIMINATION_FORMAT } from "@/formats";
import { listEliminationMatches } from "@/formats/group-double-elimination/bracket";
import { resolveTeamDisplayName } from "@/formats/group-double-elimination/category";
import { calculateGroupStandings } from "@/formats/group-double-elimination/groupStandings";
import { getGameLabel } from "@/formats/group-double-elimination/gameNumbers";
import {
  saveGsdeTournament,
  type GsdeTournamentDocument,
} from "@/formats/group-double-elimination/persistence";
import {
  findRegistrationByUid,
  getRegisteredTeamId,
} from "@/formats/group-double-elimination/registration";
import {
  findSubmissionForMatch,
  listPlayerSubmittableMatches,
  submitPlayerEliminationScore,
  submitPlayerGroupScore,
  type SubmittableMatch,
} from "@/formats/group-double-elimination/playerSubmission";
import { validateScore } from "@/formats/group-double-elimination/scoreRules";
import {
  buildPlayerView,
  type PlayerEliminationMatch,
} from "@/formats/group-double-elimination/playerView";
import {
  gsdeHref,
  gsdePlayerRoute,
  teamNameMap,
  useGsdeAuth,
  useGsdePlayerRedirect,
  useGsdeTournament,
} from "./shared";
import { GsdePublicShell } from "./PublicShell";

const CARD = "bg-white/80 backdrop-blur-sm border border-sand-dark/20 shadow-beach";
const ROUTE = GROUP_DOUBLE_ELIMINATION_FORMAT.route;

interface MatchCardData {
  key: string;
  matchId: string;
  number: string;
  stage: "Group" | "Elimination";
  stageOrder: number;
  opponentId: string | null;
  opponentName: string;
  court: string | null;
  scheduledAt: string | null;
  completed: boolean;
  scoreFor: number | null;
  scoreAgainst: number | null;
  won: boolean;
  submittable: SubmittableMatch | undefined;
  locked: boolean;
}

/** Optional metadata only — this format does not currently store court/time. */
const optionalMeta = (match: object | null): { court: string | null; scheduledAt: string | null } => {
  if (!match) return { court: null, scheduledAt: null };
  const raw = match as Record<string, unknown>;
  const court =
    typeof raw.court === "string"
      ? raw.court
      : typeof raw.net === "string"
        ? raw.net
        : null;
  const scheduledAt =
    typeof raw.scheduledAt === "string"
      ? raw.scheduledAt
      : typeof raw.time === "string"
        ? raw.time
        : null;
  return { court, scheduledAt };
};

const eliminationLabel = (match: PlayerEliminationMatch): string => {
  const phase =
    match.phase === "grand-final"
      ? "Grand Final"
      : match.phase === "winners"
        ? "Winners"
        : "Losers";
  return `${match.gameLabel} · ${phase} R${match.round}`;
};

/** My Tournament: the single player-facing view after a team is confirmed. */
export default function GroupDoubleEliminationPlayerView() {
  const { id, doc, loading, error } = useGsdeTournament();
  const { user } = useGsdeAuth();

  useGsdePlayerRedirect({
    current: "my-tournament",
    doc,
    id,
    uid: user?.uid,
    ready: !loading,
  });

  const registeredTeamId = doc && user ? getRegisteredTeamId(doc, user.uid) : null;
  const teamId = registeredTeamId ?? "";
  const view = useMemo(
    () => (doc && teamId ? buildPlayerView(doc, teamId) : null),
    [doc, teamId]
  );
  const names = useMemo(
    () => teamNameMap(doc?.teams ?? [], doc?.registrations ?? []),
    [doc?.teams, doc?.registrations]
  );

  const team = teamId ? doc?.teams.find((item) => item.id === teamId) : undefined;
  const members = team
    ? team.playerIds.map(
        (uid) => findRegistrationByUid(doc!, uid)?.name ?? names.get(uid) ?? uid
      )
    : [];
  const teamStatus = !team
    ? "Inactive"
    : team.status === "confirmed"
      ? "Confirmed"
      : team.status === "pending"
        ? "Pending"
        : "Approved";

  const canSubmit = Boolean(doc && user && registeredTeamId);
  const submittable = useMemo<SubmittableMatch[]>(
    () =>
      canSubmit && doc && registeredTeamId
        ? listPlayerSubmittableMatches(doc, registeredTeamId)
        : [],
    [canSubmit, doc, registeredTeamId]
  );
  const submittableById = useMemo(
    () => new Map(submittable.map((item) => [item.matchId, item])),
    [submittable]
  );

  const standings = useMemo(() => {
    if (!doc || !view?.group || !teamId) return [];
    const group =
      doc.groups.find((item) => item.id === view.group?.groupId) ??
      doc.groups.find((item) => item.teamIds.includes(teamId));
    if (!group) return [];
    return calculateGroupStandings(
      group,
      doc.matches,
      doc.settings.groupTiebreakers
    ).rows;
  }, [doc, view?.group, teamId]);

  const matches = useMemo<MatchCardData[]>(() => {
    if (!doc || !teamId) return [];
    const cards: MatchCardData[] = [];

    for (const match of doc.matches) {
      if (match.teamAId !== teamId && match.teamBId !== teamId) continue;
      const isA = match.teamAId === teamId;
      const opponentId = isA ? match.teamBId : match.teamAId;
      const meta = optionalMeta(match);
      cards.push({
        key: match.id,
        matchId: match.id,
        number: `Match ${match.index + 1}`,
        stage: "Group",
        stageOrder: 0,
        opponentId,
        opponentName: names.get(opponentId) ?? opponentId,
        court: meta.court,
        scheduledAt: meta.scheduledAt,
        completed: match.status === "completed",
        scoreFor: match.status === "completed" ? (isA ? match.scoreA : match.scoreB) : null,
        scoreAgainst: match.status === "completed" ? (isA ? match.scoreB : match.scoreA) : null,
        won: match.status === "completed" && match.winnerId === teamId,
        submittable: submittableById.get(match.id),
        locked: Boolean(findSubmissionForMatch(doc, match.id)),
      });
    }

    const rawElimination = doc.elimination ? listEliminationMatches(doc.elimination) : [];
    for (const match of view?.elimination?.matches ?? []) {
      const raw = rawElimination.find((item) => item.id === match.matchId) ?? null;
      const meta = optionalMeta(raw);
      cards.push({
        key: match.matchId,
        matchId: match.matchId,
        number: eliminationLabel(match),
        stage: "Elimination",
        stageOrder: 1,
        opponentId: match.opponentId,
        opponentName: match.opponentId
          ? names.get(match.opponentId) ?? match.opponentId
          : "Opponent to be decided",
        court: meta.court,
        scheduledAt: meta.scheduledAt,
        completed: match.status === "completed",
        scoreFor: match.status === "completed" ? match.scoreFor : null,
        scoreAgainst: match.status === "completed" ? match.scoreAgainst : null,
        won: match.status === "completed" && match.won,
        submittable: submittableById.get(match.matchId),
        locked: Boolean(findSubmissionForMatch(doc, match.matchId)),
      });
    }

    return cards.sort((a, b) => {
      if (a.stageOrder !== b.stageOrder) return a.stageOrder - b.stageOrder;
      if (a.stage === "Group") return a.matchId.localeCompare(b.matchId);
      return a.number.localeCompare(b.number);
    });
  }, [doc, teamId, names, view?.elimination?.matches, submittableById]);

  const [drafts, setDrafts] = useState<Record<string, { for: string; against: string }>>({});
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const draftValue = (matchId: string, field: "for" | "against"): string =>
    drafts[matchId]?.[field] ?? "";

  const setDraftValue = (matchId: string, field: "for" | "against", value: string) =>
    setDrafts((previous) => ({
      ...previous,
      [matchId]: {
        for: previous[matchId]?.for ?? "",
        against: previous[matchId]?.against ?? "",
        [field]: value,
      },
    }));

  const focusScore = (matchId: string) => {
    const input = document.getElementById(`score-for-${matchId}`);
    input?.scrollIntoView({ behavior: "smooth", block: "center" });
    input?.focus();
  };

  const submitScore = async (item: SubmittableMatch) => {
    if (!doc || !user || !registeredTeamId) return;
    const rawFor = draftValue(item.matchId, "for");
    const rawAgainst = draftValue(item.matchId, "against");
    if (rawFor.trim() === "" || rawAgainst.trim() === "") {
      setNotice({ kind: "error", text: "Enter both scores before submitting." });
      return;
    }
    const scoreFor = Number(rawFor);
    const scoreAgainst = Number(rawAgainst);
    const validation = validateScore(scoreFor, scoreAgainst);
    if (!validation.valid) {
      setNotice({ kind: "error", text: validation.message ?? "Invalid score." });
      return;
    }

    setSubmitting(item.matchId);
    setNotice(null);
    try {
      const input = {
        uid: user.uid,
        matchId: item.matchId,
        scoreFor,
        scoreAgainst,
      };
      const transform = (current: GsdeTournamentDocument) =>
        item.stage === "group"
          ? submitPlayerGroupScore(current, input)
          : submitPlayerEliminationScore(current, input);
      await saveGsdeTournament(transform(doc));
      setDrafts((previous) => {
        const next = { ...previous };
        delete next[item.matchId];
        return next;
      });
      setNotice({
        kind: "ok",
        text: "Score submitted and locked. Only an admin can correct it now.",
      });
    } catch (caught) {
      setNotice({
        kind: "error",
        text: caught instanceof Error ? caught.message : "Could not submit the score.",
      });
    } finally {
      setSubmitting(null);
    }
  };

  if (loading) {
    return (
      <GsdePublicShell
        emoji="🏐"
        title="My Tournament"
        backTo={gsdeHref(ROUTE, id)}
        backLabel="Tournament"
        showAutoFooter={false}
      >
        <Card className={CARD}>
          <CardContent className="flex items-center justify-center gap-2 p-10 text-sm text-foreground/60">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading your tournament…
          </CardContent>
        </Card>
      </GsdePublicShell>
    );
  }

  if (error) {
    return (
      <GsdePublicShell
        emoji="🏐"
        title="My Tournament"
        backTo={gsdeHref(ROUTE, id)}
        backLabel="Tournament"
        showAutoFooter={false}
      >
        <Alert className="border-coral/30 bg-coral/10">
          <AlertCircle className="h-4 w-4 text-coral" />
          <AlertDescription className="text-sm text-coral">
            Could not load this tournament: {error}
          </AlertDescription>
        </Alert>
      </GsdePublicShell>
    );
  }

  if (!user || !doc || !registeredTeamId || !view || !team) {
    return (
      <GsdePublicShell
        emoji="🏐"
        title="My Tournament"
        backTo={gsdeHref(ROUTE, id)}
        backLabel="Tournament"
        showAutoFooter={false}
      >
        <Card className={CARD}>
          <CardContent className="space-y-3 p-6 text-center text-sm text-foreground/70">
            <Loader2 className="mx-auto h-5 w-5 animate-spin text-ocean" />
            <p>
              {user
                ? "Opening your tournament view…"
                : "Sign in to see your team and matches."}
            </p>
            {!user ? (
              <Button
                onClick={() =>
                  window.location.assign(gsdePlayerRoute("player-access", id))
                }
                className="w-full touch-target bg-ocean hover:bg-ocean-dark text-white font-semibold"
              >
                Go to player access
              </Button>
            ) : null}
          </CardContent>
        </Card>
      </GsdePublicShell>
    );
  }

  const group = view.group;
  const elimination = view.elimination;

  return (
    <GsdePublicShell
      emoji="🏐"
      title="My Tournament"
      subtitle={`${GROUP_DOUBLE_ELIMINATION_FORMAT.name} · your team`}
      backTo={gsdeHref(ROUTE, id)}
      backLabel="Tournament"
      showAutoFooter={false}
      badge={
        <Badge className="bg-palm/15 text-palm-dark border border-palm/30">
          <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> {teamStatus} team
        </Badge>
      }
    >
      {notice ? (
        <Alert
          className={
            notice.kind === "ok"
              ? "border-palm/30 bg-palm/10"
              : "border-coral/30 bg-coral/10"
          }
        >
          {notice.kind === "ok" ? (
            <CheckCircle2 className="h-4 w-4 text-palm" />
          ) : (
            <AlertCircle className="h-4 w-4 text-coral" />
          )}
          <AlertDescription
            className={`text-sm ${notice.kind === "ok" ? "text-palm-dark" : "text-coral"}`}
          >
            {notice.text}
          </AlertDescription>
        </Alert>
      ) : null}

      {/* 1 — My Team */}
      <Card className={`${CARD} border-ocean/20`}>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg text-ocean">
            <Users className="h-5 w-5" /> My Team
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xl font-bold text-foreground break-words">
            {members.join(" & ")}
          </p>
          <div className="flex flex-wrap gap-2">
            <Badge
              className={
                teamStatus === "Confirmed"
                  ? "bg-palm/15 text-palm-dark border border-palm/30"
                  : "bg-sky-100 text-sky-800"
              }
            >
              {teamStatus}
            </Badge>
            <Badge variant="secondary">{doc.tournament.config.category}</Badge>
          </div>
        </CardContent>
      </Card>

      {/* 2 — My Group */}
      <Card className={CARD}>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg text-ocean">
            <Layers className="h-5 w-5" /> My Group
          </CardTitle>
        </CardHeader>
        <CardContent>
          {group && group.groupName ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-lg font-bold text-foreground">{group.groupName}</p>
                <Badge className="bg-ocean text-white hover:bg-ocean">
                  Position {group.standing?.rank ?? "—"}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="rounded-xl bg-white/70 p-3 text-center">
                  <p className="text-xl font-bold tabular-nums text-foreground">
                    {group.standing?.wins ?? 0}
                  </p>
                  <p className="text-[10px] uppercase tracking-wide text-foreground/60">Wins</p>
                </div>
                <div className="rounded-xl bg-white/70 p-3 text-center">
                  <p className="text-xl font-bold tabular-nums text-foreground">
                    {group.standing?.losses ?? 0}
                  </p>
                  <p className="text-[10px] uppercase tracking-wide text-foreground/60">Losses</p>
                </div>
                <div className="rounded-xl bg-white/70 p-3 text-center">
                  <p className="text-xl font-bold tabular-nums text-foreground">
                    {group.standing?.pointsFor ?? 0}
                  </p>
                  <p className="text-[10px] uppercase tracking-wide text-foreground/60">Points for</p>
                </div>
                <div className="rounded-xl bg-white/70 p-3 text-center">
                  <p className="text-xl font-bold tabular-nums text-foreground">
                    {group.standing?.pointsAgainst ?? 0}
                  </p>
                  <p className="text-[10px] uppercase tracking-wide text-foreground/60">Against</p>
                </div>
              </div>
              <p className="flex items-center gap-1.5 text-sm text-palm-dark">
                <CheckCircle2 className="h-4 w-4" /> Qualified — every team advances to the bracket.
              </p>
            </div>
          ) : (
            <p className="py-3 text-center text-sm text-foreground/60">
              Group allocation pending.
            </p>
          )}
        </CardContent>
      </Card>

      {/* 3 — Group Standings */}
      <Card className={CARD}>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg text-ocean">
            <Trophy className="h-5 w-5" /> Group Standings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {standings.length === 0 ? (
            <p className="py-3 text-center text-sm text-foreground/60">
              Standings appear once groups are allocated.
            </p>
          ) : (
            <>
              <div className="hidden grid-cols-[2rem_1fr_2.2rem_2.2rem_2.2rem_2.6rem_2.6rem_2.4rem] gap-1 px-3 text-[10px] font-semibold uppercase tracking-wide text-foreground/50 sm:grid">
                <span>#</span>
                <span>Team</span>
                <span className="text-center">MP</span>
                <span className="text-center">W</span>
                <span className="text-center">L</span>
                <span className="text-center">PF</span>
                <span className="text-center">PA</span>
                <span className="text-center">Pts</span>
              </div>
              {standings.map((row) => {
                const mine = row.teamId === teamId;
                const rowName = resolveTeamDisplayName(doc.registrations ?? [], {
                  ...(doc.teams.find((item) => item.id === row.teamId) ?? {
                    id: row.teamId,
                    name: row.teamId,
                    playerIds: [],
                    seed: null,
                    groupId: null,
                  }),
                });
                const rankingPoints = row.wins * 2 + row.losses;
                return (
                  <div
                    key={row.teamId}
                    className={`rounded-xl border p-3 text-sm ${
                      mine
                        ? "border-ocean/40 bg-ocean/10 ring-1 ring-ocean/30"
                        : "border-sand-dark/20 bg-white/70"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                          row.rank === 1
                            ? "bg-sunset text-white"
                            : row.rank === 2
                              ? "bg-ocean/25 text-ocean-dark"
                              : row.rank === 3
                                ? "bg-palm/25 text-palm-dark"
                                : "bg-sand-light text-foreground/70"
                        }`}
                      >
                        {row.rank}
                      </span>
                      <span className={`min-w-0 flex-1 truncate font-semibold ${mine ? "text-ocean" : "text-foreground"}`}>
                        {rowName}
                        {mine ? " (you)" : ""}
                      </span>
                      <Badge variant="outline" className="shrink-0 text-xs">
                        {rankingPoints} pts
                      </Badge>
                    </div>
                    <div className="mt-2 grid grid-cols-4 gap-1 text-center text-xs text-foreground/70 sm:hidden">
                      <span>MP {row.played}</span>
                      <span>W {row.wins}</span>
                      <span>L {row.losses}</span>
                      <span>PF {row.pointsFor}</span>
                      <span>PA {row.pointsAgainst}</span>
                    </div>
                    <div className="mt-2 hidden grid-cols-[1fr_2.2rem_2.2rem_2.2rem_2.6rem_2.6rem] gap-1 text-center text-xs tabular-nums text-foreground/70 sm:grid">
                      <span />
                      <span>{row.played}</span>
                      <span>{row.wins}</span>
                      <span>{row.losses}</span>
                      <span>{row.pointsFor}</span>
                      <span>{row.pointsAgainst}</span>
                    </div>
                  </div>
                );
              })}
              <p className="px-1 text-[11px] text-foreground/55">
                Ranking points shown for reference (win 2 · loss 1). Official order uses wins then
                the configured tiebreakers.
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {/* 4 — My Matches */}
      <Card className={CARD}>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg text-ocean">
            <CalendarClock className="h-5 w-5" /> My Matches
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {matches.length === 0 ? (
            <p className="py-3 text-center text-sm text-foreground/60">
              No matches have been scheduled for your team yet.
            </p>
          ) : (
            matches.map((match) => (
              <div
                key={match.key}
                className="rounded-xl border border-sand-dark/20 bg-white/70 p-3 space-y-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      {match.stage}
                    </Badge>
                    <span className="text-xs font-semibold text-ocean">{match.number}</span>
                  </div>
                  <Badge
                    variant="outline"
                    className={
                      match.completed
                        ? match.won
                          ? "border-palm/40 text-palm-dark"
                          : "border-coral/40 text-coral"
                        : match.submittable
                          ? "border-sky-300 text-sky-700"
                          : "border-amber-300 text-amber-700"
                    }
                  >
                    {match.completed
                      ? match.won
                        ? "Win"
                        : "Loss"
                      : match.submittable
                        ? "Ready to submit"
                        : "Scheduled"}
                  </Badge>
                </div>

                <p className="truncate text-sm font-semibold text-foreground">
                  vs {match.opponentName}
                </p>

                {match.court || match.scheduledAt ? (
                  <div className="flex flex-wrap gap-2 text-xs text-foreground/60">
                    {match.court ? (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" /> {match.court}
                      </span>
                    ) : null}
                    {match.scheduledAt ? (
                      <span className="inline-flex items-center gap-1">
                        <Clock3 className="h-3.5 w-3.5" /> {match.scheduledAt}
                      </span>
                    ) : null}
                  </div>
                ) : null}

                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-foreground/60">Score</span>
                  <span className="text-xl font-bold tabular-nums text-foreground">
                    {match.scoreFor !== null && match.scoreAgainst !== null
                      ? `${match.scoreFor} : ${match.scoreAgainst}`
                      : "— : —"}
                  </span>
                </div>

                {match.submittable ? (
                  <Button
                    size="sm"
                    onClick={() => focusScore(match.matchId)}
                    className="w-full touch-target bg-ocean hover:bg-ocean-dark text-white font-semibold"
                  >
                    <Send className="h-4 w-4 mr-2" /> Submit score
                  </Button>
                ) : match.locked ? (
                  <p className="flex items-center gap-1.5 text-xs text-sky-700">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Score submitted · locked
                  </p>
                ) : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* 5 — Score submission */}
      {canSubmit && submittable.length > 0 ? (
        <Card className={`${CARD} border-palm/30`}>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg text-palm-dark">
              <Send className="h-5 w-5" /> Score submission
            </CardTitle>
            <p className="text-xs text-foreground/60">
              Enter your team&apos;s score first. First to 21, win by 2 (22–20, 25–23…).
              Each match can be submitted once.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {submittable.map((item) => (
              <div
                key={item.matchId}
                className="rounded-xl border border-palm/25 bg-white/70 p-3 space-y-2"
              >
                <p className="text-xs font-semibold text-ocean">
                  {item.stage === "group" ? "Group" : "Elimination"} · {item.gameLabel}
                  <span className="font-normal text-foreground/60">
                    {" "}
                    · vs {submittableById.get(item.matchId)?.opponentId
                      ? names.get(submittableById.get(item.matchId)!.opponentId ?? "") ??
                        submittableById.get(item.matchId)?.opponentId
                      : "TBD"}
                  </span>
                </p>
                <div className="flex items-center justify-center gap-2">
                  <Input
                    id={`score-for-${item.matchId}`}
                    aria-label={`Your score for ${item.matchId}`}
                    className="h-11 w-20 text-center text-lg font-bold"
                    inputMode="numeric"
                    type="number"
                    min={0}
                    value={draftValue(item.matchId, "for")}
                    onChange={(event) =>
                      setDraftValue(item.matchId, "for", event.target.value)
                    }
                  />
                  <span className="text-lg font-bold text-foreground/40">:</span>
                  <Input
                    id={`score-against-${item.matchId}`}
                    aria-label={`Opponent score for ${item.matchId}`}
                    className="h-11 w-20 text-center text-lg font-bold"
                    inputMode="numeric"
                    type="number"
                    min={0}
                    value={draftValue(item.matchId, "against")}
                    onChange={(event) =>
                      setDraftValue(item.matchId, "against", event.target.value)
                    }
                  />
                </div>
                <Button
                  disabled={submitting === item.matchId}
                  onClick={() => submitScore(item)}
                  className="w-full touch-target bg-palm hover:bg-palm-dark text-white font-bold py-3"
                >
                  {submitting === item.matchId ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Submitting…
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4 mr-2" /> Submit score
                    </>
                  )}
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {/* 6 — Tournament progression */}
      {elimination ? (
        <Card className={`${CARD} border-sunset/30`}>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg text-amber-900">
              <Swords className="h-5 w-5" /> Tournament Progression
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-amber-900">
            <div className="flex flex-wrap gap-2">
              <Badge className="bg-white/70 text-ocean hover:bg-white/70">
                Qualified from {group?.groupName ?? "group"} · #{group?.standing?.rank ?? "—"}
              </Badge>
              <Badge className="bg-white/70 text-amber-900 hover:bg-white/70">
                {elimination.currentBracket === "grand-final"
                  ? "Grand Final"
                  : elimination.currentBracket === "losers"
                    ? "Losers Bracket"
                    : elimination.currentBracket === "winners"
                      ? "Winners Bracket"
                      : "Bracket pending"}
              </Badge>
              <Badge
                className={
                  elimination.competing
                    ? "bg-palm/15 text-palm-dark hover:bg-palm/15"
                    : "bg-slate-200 text-slate-700 hover:bg-slate-200"
                }
              >
                {elimination.competing ? "Still competing" : "Eliminated"}
              </Badge>
              {elimination.finalPlace ? (
                <Badge className="bg-white/70 text-amber-900 hover:bg-white/70">
                  Final place {elimination.finalPlace}
                </Badge>
              ) : null}
            </div>

            {elimination.status === "champion" ? (
              <p className="flex items-center gap-2 rounded-xl bg-yellow-500/15 p-3 font-bold text-amber-900">
                <Crown className="h-5 w-5" /> Champion: {view.teamName}
              </p>
            ) : elimination.nextMatch ? (
              <p className="flex flex-wrap items-center gap-1.5">
                <CalendarClock className="h-4 w-4" />
                <strong>Next match:</strong>{" "}
                {elimination.nextMatch.opponentId
                  ? names.get(elimination.nextMatch.opponentId) ??
                    elimination.nextMatch.opponentId
                  : "opponent to be decided"}
                <span className="text-amber-800/70">
                  · {elimination.nextMatch.gameLabel} · Round {elimination.nextMatch.round}
                </span>
              </p>
            ) : (
              <p className="flex items-center gap-1.5">
                <ShieldAlert className="h-4 w-4" /> No upcoming bracket match — your run has ended.
              </p>
            )}

            <div className="space-y-2">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground/60">
                <GitBranch className="h-3.5 w-3.5" /> Your bracket matches
              </p>
              {elimination.matches.map((match) => (
                <div
                  key={match.matchId}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-sand-dark/20 bg-white/70 px-3 py-2 text-xs"
                >
                  <span className="font-semibold text-ocean">{eliminationLabel(match)}</span>
                  <span className="min-w-0 flex-1 truncate text-foreground/70">
                    {match.opponentId
                      ? `vs ${names.get(match.opponentId) ?? match.opponentId}`
                      : "Opponent to be decided"}
                  </span>
                  <span className="tabular-nums font-semibold">
                    {match.status === "completed"
                      ? `${match.scoreFor ?? "–"} : ${match.scoreAgainst ?? "–"}`
                      : "— : —"}
                  </span>
                  <Badge variant="outline" className="text-[10px]">
                    {match.status === "completed"
                      ? match.won
                        ? "Win"
                        : "Loss"
                      : "Scheduled"}
                  </Badge>
                </div>
              ))}
            </div>

            <p className="text-xs text-amber-800/80">
              {elimination.eliminationWins} wins · {elimination.eliminationLosses} elimination
              losses. Group losses are tracked separately.
            </p>
          </CardContent>
        </Card>
      ) : view.stage === "completed" ? (
        <Card className={`${CARD} border-palm/30`}>
          <CardContent className="flex items-center gap-2 p-4 text-sm text-palm-dark">
            <XCircle className="h-4 w-4" /> Final place {elimination?.finalPlace ?? "—"} for{" "}
            {view.teamName}.
          </CardContent>
        </Card>
      ) : null}
    </GsdePublicShell>
  );
}
