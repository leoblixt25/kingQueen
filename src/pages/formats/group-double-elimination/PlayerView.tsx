import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  Crown,
  GitBranch,
  Layers,
  Loader2,
  ShieldAlert,
  Swords,
  Users,
  XCircle,
} from "lucide-react";
import { GROUP_DOUBLE_ELIMINATION_FORMAT } from "@/formats";
import {
  buildPlayerView,
  type PlayerEliminationMatch,
  type PlayerGroupMatch,
} from "@/formats/group-double-elimination/playerView";
import {
  PageShell,
  STATUS_LABEL,
  statusColor,
  useGsdeTournament,
} from "./shared";
import { PlacementsView } from "./views";

const STAGE_LABEL = {
  registration: "Registration",
  "group-stage": "Group stage",
  elimination: "Double elimination",
  completed: "Tournament complete",
} as const;

function matchUrl(id: string, teamId?: string | null): string {
  const params = new URLSearchParams({ id });
  if (teamId) params.set("team", teamId);
  return `${GROUP_DOUBLE_ELIMINATION_FORMAT.route}/player?${params.toString()}`;
}

function GroupMatchRow({
  match,
  names,
}: {
  match: PlayerGroupMatch;
  names: Map<string, string>;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-sand-dark/25 bg-white/60 px-2.5 py-1.5 text-sm">
      <span className="text-xs text-foreground/55">Round {match.round}</span>
      <span className="flex-1 truncate font-medium text-foreground/85">
        vs {names.get(match.opponentId) ?? match.opponentId}
      </span>
      <span className="tabular-nums font-semibold">
        {match.status === "completed"
          ? `${match.scoreFor} : ${match.scoreAgainst}`
          : "— : —"}
      </span>
      <Badge
        variant="outline"
        className={
          match.status === "completed"
            ? match.won
              ? "border-emerald-300 text-emerald-700"
              : "border-red-300 text-red-700"
            : "border-amber-300 text-amber-700"
        }
      >
        {match.status === "completed"
          ? match.won
            ? "Win"
            : "Loss"
          : "Upcoming"}
      </Badge>
    </div>
  );
}

function EliminationMatchRow({
  match,
  names,
}: {
  match: PlayerEliminationMatch;
  names: Map<string, string>;
}) {
  const phaseLabel =
    match.phase === "grand-final" ? "Grand Final" : match.phase === "winners" ? "Winners" : "Losers";
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-sand-dark/25 bg-white/60 px-2.5 py-1.5 text-sm">
      <span className="min-w-[130px] text-xs font-semibold text-ocean">
        {match.gameLabel} · {phaseLabel} R{match.round}
      </span>
      <span className="flex-1 truncate text-foreground/80">
        {match.opponentId
          ? `vs ${names.get(match.opponentId) ?? match.opponentId}`
          : "Opponent to be decided"}
      </span>
      <span className="tabular-nums font-semibold">
        {match.status === "completed"
          ? `${match.scoreFor ?? "–"} : ${match.scoreAgainst ?? "–"}`
          : "— : —"}
      </span>
      <Badge
        variant="outline"
        className={
          match.status === "completed"
            ? match.won
              ? "border-emerald-300 text-emerald-700"
              : "border-red-300 text-red-700"
            : "border-amber-300 text-amber-700"
        }
      >
        {match.status === "completed" ? (match.won ? "Win" : "Loss") : "Scheduled"}
      </Badge>
    </div>
  );
}

export default function GroupDoubleEliminationPlayerView() {
  const { id, doc, loading, error } = useGsdeTournament();
  const [searchParams, setSearchParams] = useSearchParams();
  const teamId = searchParams.get("team")?.trim() ?? "";
  const names = useMemo(
    () => new Map((doc?.teams ?? []).map((team) => [team.id, team.name])),
    [doc?.teams]
  );
  const view = useMemo(
    () => (doc && teamId ? buildPlayerView(doc, teamId) : null),
    [doc, teamId]
  );

  const selectTeam = (next: string) => {
    const params = new URLSearchParams(searchParams);
    params.set("id", id);
    if (next) params.set("team", next);
    else params.delete("team");
    setSearchParams(params);
  };

  const status = doc?.tournament.status ?? "draft";

  return (
    <PageShell
      title="My tournament"
      subtitle={`${GROUP_DOUBLE_ELIMINATION_FORMAT.name} · stage-dependent team view`}
      backTo={`${GROUP_DOUBLE_ELIMINATION_FORMAT.route}${id !== "default" ? `?id=${encodeURIComponent(id)}` : ""}`}
      backLabel="Tournament overview"
      badge={
        view ? (
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusColor(status)}`}>
            {STAGE_LABEL[view.stage]}
          </span>
        ) : undefined
      }
    >
      {loading ? (
        <Card className="border-sand-dark/40 shadow-beach bg-card/95">
          <CardContent className="flex items-center justify-center gap-2 p-10 text-sm text-foreground/60">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading tournament…
          </CardContent>
        </Card>
      ) : error ? (
        <Card className="border-red-300 bg-red-50">
          <CardContent className="flex items-center gap-2 p-4 text-sm text-red-800">
            <AlertCircle className="h-4 w-4" /> Could not load this tournament: {error}
          </CardContent>
        </Card>
      ) : doc ? (
        <>
          <Card className="border-ocean/20 bg-ocean/5 shadow-sm">
            <CardContent className="flex flex-wrap items-end gap-3 p-4">
              <label className="flex-1 min-w-[200px] text-xs text-foreground/60">
                Choose your team
                <select
                  className="mt-1 h-9 w-full rounded-md border border-sand-dark/40 bg-white px-2 text-sm"
                  value={teamId}
                  onChange={(event) => selectTeam(event.target.value)}
                >
                  <option value="">Select a team…</option>
                  {doc.teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="text-xs text-foreground/60">
                <p className="font-semibold text-foreground/80">
                  {doc.tournament.config.name || "Unnamed tournament"}
                </p>
                <p>
                  Event id <code className="rounded bg-white/70 px-1 py-0.5">{id}</code>
                  {" · "}
                  <Badge variant="secondary">{STATUS_LABEL[status]}</Badge>
                </p>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link to={matchUrl(id, teamId)}>Copy-friendly link to my team</Link>
              </Button>
            </CardContent>
          </Card>

          {!teamId ? (
            <Card className="border-sand-dark/40 shadow-beach bg-card/95">
              <CardContent className="p-8 text-center text-sm text-foreground/60">
                Select your team above to see stage-specific information.
              </CardContent>
            </Card>
          ) : view ? (
            <div className="space-y-6">
              {view.stage === "registration" ? (
                <Card className="border-sand-dark/40 shadow-beach bg-card/95">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Users className="h-4 w-4 text-ocean" /> Registration
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1 text-sm text-foreground/75">
                    <p>
                      <strong>{view.teamName}</strong> is registered. Groups have not been
                      generated yet.
                    </p>
                    <p className="text-foreground/60">
                      Once the group stage starts you will see your group, opponents,
                      upcoming matches, results and current ranking here.
                    </p>
                  </CardContent>
                </Card>
              ) : null}

              {view.group ? (
                <Card className="border-sand-dark/40 shadow-beach bg-card/95">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Layers className="h-4 w-4 text-ocean" />
                      {view.group.groupName ?? "Your group"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex flex-wrap gap-2 text-xs">
                      <Badge variant="secondary">
                        Rank {view.group.standing?.rank ?? "—"}
                      </Badge>
                      <Badge variant="outline">
                        {view.group.standing?.wins ?? 0}W – {view.group.groupLosses}L
                      </Badge>
                      <Badge variant="outline">
                        {view.group.groupLosses} group loss
                        {view.group.groupLosses === 1 ? "" : "es"}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {view.group.opponents.map((opponent) => (
                        <Badge key={opponent.teamId} variant="outline" className="text-xs">
                          {opponent.name}
                        </Badge>
                      ))}
                    </div>
                    {view.group.upcoming.length > 0 ? (
                      <div className="space-y-1.5">
                        <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground/60">
                          <CalendarClock className="h-3.5 w-3.5" /> Upcoming matches
                        </p>
                        {view.group.upcoming.map((match) => (
                          <GroupMatchRow key={match.matchId} match={match} names={names} />
                        ))}
                      </div>
                    ) : null}
                    {view.group.results.length > 0 ? (
                      <div className="space-y-1.5">
                        <p className="text-xs font-semibold text-foreground/60">Results</p>
                        {view.group.results.map((match) => (
                          <GroupMatchRow key={match.matchId} match={match} names={names} />
                        ))}
                      </div>
                    ) : null}
                    <p className="text-xs text-foreground/55">
                      All four teams qualify. Group losses never count as elimination losses.
                    </p>
                  </CardContent>
                </Card>
              ) : null}

              {view.elimination ? (
                <>
                  <Card className="border-amber-300/60 bg-amber-50/70 shadow-sm">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2 text-amber-900">
                        <Swords className="h-4 w-4" /> Elimination stage
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm text-amber-900">
                      <div className="flex flex-wrap gap-2 text-xs">
                        <Badge className="bg-white/70 text-amber-900 hover:bg-white/70">
                          {view.elimination.currentBracket === "grand-final"
                            ? "Grand Final"
                            : view.elimination.currentBracket === "losers"
                              ? "Losers Bracket"
                              : "Winners Bracket"}
                        </Badge>
                        <Badge className="bg-white/70 text-amber-900 hover:bg-white/70">
                          {view.elimination.eliminationLosses} elimination loss
                          {view.elimination.eliminationLosses === 1 ? "" : "es"}
                        </Badge>
                        <Badge
                          className={
                            view.elimination.competing
                              ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-100"
                              : "bg-slate-200 text-slate-700 hover:bg-slate-200"
                          }
                        >
                          {view.elimination.competing ? "Still competing" : "Eliminated"}
                        </Badge>
                        {view.elimination.finalPlace ? (
                          <Badge className="bg-white/70 text-amber-900 hover:bg-white/70">
                            Final place {view.elimination.finalPlace}
                          </Badge>
                        ) : null}
                      </div>
                      {view.elimination.nextMatch ? (
                        <p className="flex flex-wrap items-center gap-1.5">
                          <CalendarClock className="h-4 w-4" />
                          <strong>Next opponent:</strong>{" "}
                          {view.elimination.nextMatch.opponentId
                            ? names.get(view.elimination.nextMatch.opponentId) ??
                              view.elimination.nextMatch.opponentId
                            : "to be decided"}{" "}
                          <span className="text-amber-800/70">
                            · {view.elimination.nextMatch.gameLabel} · Round{" "}
                            {view.elimination.nextMatch.round}
                          </span>
                        </p>
                      ) : (
                        <p className="flex items-center gap-1.5">
                          {view.elimination.status === "champion" ? (
                            <Crown className="h-4 w-4" />
                          ) : (
                            <ShieldAlert className="h-4 w-4" />
                          )}
                          No upcoming match — your bracket run has ended.
                        </p>
                      )}
                      <p className="text-xs text-amber-800/80">
                        Group losses ({view.group?.groupLosses ?? 0}) and elimination
                        losses ({view.elimination.eliminationLosses}) are separate totals.
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="border-sand-dark/40 shadow-beach bg-card/95">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <GitBranch className="h-4 w-4 text-ocean" /> Your elimination schedule
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-1.5">
                      {view.elimination.matches.map((match) => (
                        <EliminationMatchRow key={match.matchId} match={match} names={names} />
                      ))}
                    </CardContent>
                  </Card>
                </>
              ) : null}

              {view.stage === "completed" ? (
                <Card className="border-emerald-300/60 bg-emerald-50/70 shadow-sm">
                  <CardContent className="flex items-center gap-2 p-4 text-sm text-emerald-900">
                    {view.elimination?.status === "champion" ? (
                      <Crown className="h-4 w-4" />
                    ) : view.elimination?.competing ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <XCircle className="h-4 w-4" />
                    )}
                    {view.elimination?.status === "champion"
                      ? `Champion: ${view.teamName}`
                      : `Final place ${view.elimination?.finalPlace ?? "—"} for ${view.teamName}.`}
                  </CardContent>
                </Card>
              ) : null}

              {view.stage === "completed" || view.stage === "elimination" ? (
                <PlacementsView doc={doc} />
              ) : null}

              <p className="text-center text-xs text-foreground/50">
                This page reads the same authoritative{" "}
                <code className="rounded bg-white/70 px-1 py-0.5">tournaments/{`{id}`}</code>{" "}
                document as the public page. King &amp; Queen data is never touched.
              </p>
            </div>
          ) : (
            <Card className="border-red-300 bg-red-50">
              <CardContent className="p-4 text-sm text-red-800">
                That team is not part of this tournament. Choose another team above.
              </CardContent>
            </Card>
          )}
        </>
      ) : null}
    </PageShell>
  );
}
