import { useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { GROUP_DOUBLE_ELIMINATION_FORMAT } from "@/formats";
import { gsdeHref, useGsdeTournament } from "./shared";
import {
  EliminationBracketView,
  GroupMatchesView,
  LiveMatchesView,
  ProgressSummary,
} from "./views";
import {
  GsdePublicShell,
  GsdeTabs,
  type GsdeTabDef,
} from "./PublicShell";

const ROUTE = GROUP_DOUBLE_ELIMINATION_FORMAT.route;

const DRAW_TABS: GsdeTabDef[] = [
  { id: "live", label: "🔴 Live", tone: "sunset" },
  { id: "bracket", label: "🌳 Bracket", tone: "ocean" },
  { id: "groups", label: "📋 Groups", tone: "beach" },
];

/** Public draw: live matches, the double-elimination bracket and group results. */
export default function GroupDoubleEliminationDraw() {
  const { id, doc, loading, error } = useGsdeTournament();
  const [active, setActive] = useState("live");

  return (
    <GsdePublicShell
      emoji="🎯"
      title="Tournament Draw"
      subtitle={`${GROUP_DOUBLE_ELIMINATION_FORMAT.name} · groups & bracket`}
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
          <GsdeTabs tabs={DRAW_TABS} active={active} onChange={setActive} />
          {active === "live" ? <LiveMatchesView doc={doc} /> : null}
          {active === "bracket" ? <EliminationBracketView doc={doc} /> : null}
          {active === "groups" ? <GroupMatchesView doc={doc} /> : null}
        </>
      ) : null}
    </GsdePublicShell>
  );
}
