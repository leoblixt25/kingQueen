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
import { AlertCircle, Loader2, Users, Wrench } from "lucide-react";
import { GROUP_DOUBLE_ELIMINATION_FORMAT } from "@/formats";
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
  PlacementsView,
  ProgressSummary,
} from "./group-double-elimination/views";

export default function GroupStageDoubleElimination() {
  const { id, doc, loading, error } = useGsdeTournament();
  const status = doc?.tournament.status ?? "draft";

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
      <Card className="border-ocean/20 bg-ocean/5 shadow-sm">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <p className="text-sm font-semibold text-foreground">
              {doc?.tournament.config.name || "Unnamed tournament"}
            </p>
            <p className="text-xs text-foreground/60">
              {doc?.tournament.config.divisionName || "Open division"} · event id{" "}
              <code className="rounded bg-white/70 px-1 py-0.5">{id}</code>
            </p>
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

      {loading ? (
        <Card className="border-sand-dark/40 shadow-beach bg-card/95">
          <CardContent className="flex items-center justify-center gap-2 p-10 text-sm text-foreground/60">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading tournament…
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
          <ProgressSummary doc={doc} />
          <Tabs defaultValue={doc.elimination ? "bracket" : "groups"}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="groups">Group stage</TabsTrigger>
              <TabsTrigger value="rankings">Rankings</TabsTrigger>
              <TabsTrigger value="bracket">Double elimination</TabsTrigger>
              <TabsTrigger value="placements">Placements</TabsTrigger>
            </TabsList>
            <TabsContent value="groups" className="mt-4 space-y-6">
              <GroupStandingsView doc={doc} />
              <GlobalRankingView doc={doc} />
              <GroupMatchesView doc={doc} />
            </TabsContent>
            <TabsContent value="rankings" className="mt-4">
              <IndependentRankingsView doc={doc} />
            </TabsContent>
            <TabsContent value="bracket" className="mt-4 space-y-6">
              <EliminationBracketView doc={doc} />
              <EliminationStandingsView doc={doc} />
            </TabsContent>
            <TabsContent value="placements" className="mt-4">
              <PlacementsView doc={doc} />
            </TabsContent>
          </Tabs>
        </>
      ) : null}

      <p className="text-center text-xs text-foreground/50">
        Group-stage losses never count as elimination losses. Open the admin
        controls to set up teams and enter scores.
      </p>
      <Badge variant="outline" className="sr-only">
        {GROUP_DOUBLE_ELIMINATION_FORMAT.id}
      </Badge>
    </PageShell>
  );
}
