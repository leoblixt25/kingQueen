import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  AlertCircle,
  CalendarDays,
  Info,
  Loader2,
  Trophy,
  Users,
  Wrench,
} from "lucide-react";
import { GROUP_DOUBLE_ELIMINATION_FORMAT } from "@/formats";
import { selectApprovedTeamCount, selectFinalResult } from "@/formats/group-double-elimination/scoring";
import {
  PageShell,
  STATUS_LABEL,
  statusColor,
  useGsdeTournament,
} from "./group-double-elimination/shared";
import {
  EliminationBracketView,
  EliminationStandingsView,
  GlobalRankingView,
  GroupMatchesView,
  GroupStandingsView,
  IndependentRankingsView,
  LiveMatchesView,
  PlacementsView,
  ProgressSummary,
  TournamentRulesView,
} from "./group-double-elimination/views";

export default function GroupStageDoubleElimination() {
  const { id, doc, loading, error } = useGsdeTournament();
  const status = doc?.tournament.status ?? "draft";
  const approved = doc ? selectApprovedTeamCount(doc) : 0;
  const finalResult = doc ? selectFinalResult(doc) : null;

  return (
    <PageShell
      title={GROUP_DOUBLE_ELIMINATION_FORMAT.name}
      subtitle="16 teams · 4 groups of 4 · Spanish double elimination"
      backTo="/"
      backLabel="Formats"
      badge={
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusColor(status)}`}
        >
          {STATUS_LABEL[status]}
        </span>
      }
    >
      {loading ? (
        <Card className="border-sand-dark/40 shadow-beach bg-card/95">
          <CardContent className="flex items-center justify-center gap-2 p-10 text-sm text-foreground/60">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading tournament…
          </CardContent>
        </Card>
      ) : error ? (
        <Card className="border-red-300 bg-red-50 shadow-sm">
          <CardContent className="flex items-center gap-2 p-4 text-sm text-red-800">
            <AlertCircle className="h-4 w-4" />
            Could not load this tournament: {error}
          </CardContent>
        </Card>
      ) : doc ? (
        <>
          <Card className="border-ocean/20 bg-ocean/5 shadow-sm">
            <CardContent className="flex flex-wrap items-start justify-between gap-4 p-4">
              <div className="space-y-1">
                <p className="text-lg font-bold text-foreground">
                  {doc.tournament.config.name || "Unnamed tournament"}
                </p>
                <p className="text-sm text-foreground/70">
                  {doc.tournament.config.divisionName || "Open division"} · event id{" "}
                  <code className="rounded bg-white/70 px-1 py-0.5">{id}</code>
                </p>
                <div className="flex flex-wrap gap-2 text-xs text-foreground/60">
                  <span className="inline-flex items-center gap-1">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {doc.tournament.config.date || "Date to be confirmed"}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" />
                    {approved}/{doc.tournament.config.teamLimit} teams approved
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Info className="h-3.5 w-3.5" />
                    {doc.tournament.config.groupCount} groups of{" "}
                    {doc.tournament.config.teamsPerGroup ?? 4}
                  </span>
                </div>
                {finalResult?.complete ? (
                  <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber-800">
                    <Trophy className="h-4 w-4" />
                    Champion:{" "}
                    {finalResult.championTeamIds
                      .map((teamId) => doc.teams.find((team) => team.id === teamId)?.name ?? teamId)
                      .join(" / ")}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link to={`${GROUP_DOUBLE_ELIMINATION_FORMAT.route}/player${id !== "default" ? `?id=${encodeURIComponent(id)}` : ""}`}>
                    <Users className="mr-1.5 h-4 w-4" />
                    My team
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link to={`${GROUP_DOUBLE_ELIMINATION_FORMAT.route}/admin${id !== "default" ? `?id=${encodeURIComponent(id)}` : ""}`}>
                    <Wrench className="mr-1.5 h-4 w-4" />
                    Admin controls
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-sand-dark/40 shadow-beach bg-card/95">
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm">
              <div>
                <p className="font-semibold text-foreground">Team registration</p>
                <p className="text-xs text-foreground/65">
                  Register with the organiser, then an admin approves each team before
                  groups are generated. Team limit: {doc.tournament.config.teamLimit}.
                </p>
              </div>
              <Badge variant="secondary">
                {approved} approved · {doc.teams.length - approved} pending
              </Badge>
            </CardContent>
          </Card>

          <ProgressSummary doc={doc} />
          <Tabs defaultValue={doc.elimination ? "bracket" : "groups"}>
            <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
              <TabsTrigger value="groups">Group stage</TabsTrigger>
              <TabsTrigger value="live">Live matches</TabsTrigger>
              <TabsTrigger value="rankings">Rankings</TabsTrigger>
              <TabsTrigger value="bracket">Double elimination</TabsTrigger>
              <TabsTrigger value="standings">Final standings</TabsTrigger>
              <TabsTrigger value="rules">Rules</TabsTrigger>
            </TabsList>
            <TabsContent value="groups" className="mt-4 space-y-6">
              <GroupStandingsView doc={doc} />
              <GlobalRankingView doc={doc} />
              <GroupMatchesView doc={doc} />
            </TabsContent>
            <TabsContent value="live" className="mt-4">
              <LiveMatchesView doc={doc} />
            </TabsContent>
            <TabsContent value="rankings" className="mt-4">
              <IndependentRankingsView doc={doc} />
            </TabsContent>
            <TabsContent value="bracket" className="mt-4 space-y-6">
              <EliminationBracketView doc={doc} />
              <EliminationStandingsView doc={doc} />
            </TabsContent>
            <TabsContent value="standings" className="mt-4 space-y-6">
              <PlacementsView doc={doc} />
              <EliminationStandingsView doc={doc} />
            </TabsContent>
            <TabsContent value="rules" className="mt-4">
              <TournamentRulesView />
            </TabsContent>
          </Tabs>
        </>
      ) : null}

      <p className="text-center text-xs text-foreground/50">
        Group-stage losses never count as elimination losses. All pages read the same
        authoritative tournament document.
      </p>
      <Badge variant="outline" className="sr-only">
        {GROUP_DOUBLE_ELIMINATION_FORMAT.id}
      </Badge>
    </PageShell>
  );
}
