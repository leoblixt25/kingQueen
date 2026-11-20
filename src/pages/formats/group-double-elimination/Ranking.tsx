import { useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { GROUP_DOUBLE_ELIMINATION_FORMAT } from "@/formats";
import { gsdeHref, useGsdeTournament } from "./shared";
import {
  EliminationStandingsView,
  GlobalRankingView,
  GroupStandingsView,
  PlacementsView,
  ProgressSummary,
  RankingSystemsNotice,
} from "./views";
import {
  GsdePublicShell,
  GsdeTabs,
  type GsdeTabDef,
} from "./PublicShell";

const ROUTE = GROUP_DOUBLE_ELIMINATION_FORMAT.route;

const RANKING_TABS: GsdeTabDef[] = [
  { id: "group", label: "🥇 Group", tone: "sunset" },
  { id: "elimination", label: "🛡️ Elimination", tone: "ocean" },
  { id: "places", label: "🏆 Places", tone: "beach" },
];

/** Public ranking: group standings, elimination status and final places. */
export default function GroupDoubleEliminationRanking() {
  const { id, doc, loading, error } = useGsdeTournament();
  const [active, setActive] = useState("group");

  return (
    <GsdePublicShell
      emoji="🏆"
      title="Live Ranking"
      subtitle={`${GROUP_DOUBLE_ELIMINATION_FORMAT.name} · group & elimination rankings`}
      backTo={gsdeHref(ROUTE, id)}
      backLabel="Tournament"
      wide
    >
      {loading ? (
        <Card className="bg-white/80 backdrop-blur-sm border border-sand-dark/20 shadow-beach">
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
          <ProgressSummary doc={doc} />
          <RankingSystemsNotice />
          <GsdeTabs tabs={RANKING_TABS} active={active} onChange={setActive} />
          {active === "group" ? (
            <div className="space-y-4">
              <GroupStandingsView doc={doc} />
              <GlobalRankingView doc={doc} />
            </div>
          ) : null}
          {active === "elimination" ? <EliminationStandingsView doc={doc} /> : null}
          {active === "places" ? <PlacementsView doc={doc} /> : null}
        </>
      ) : null}
    </GsdePublicShell>
  );
}
