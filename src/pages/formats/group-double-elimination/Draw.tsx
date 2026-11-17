import { AlertCircle, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { GROUP_DOUBLE_ELIMINATION_FORMAT } from "@/formats";
import { PageShell, gsdeHref, useGsdeTournament } from "./shared";
import {
  EliminationBracketView,
  GroupMatchesView,
  LiveMatchesView,
  ProgressSummary,
} from "./views";

const ROUTE = GROUP_DOUBLE_ELIMINATION_FORMAT.route;

/** Public draw: group schedule, live matches and the double-elimination bracket. */
export default function GroupDoubleEliminationDraw() {
  const { id, doc, loading, error } = useGsdeTournament();

  return (
    <PageShell
      title="Tournament Draw"
      subtitle={`${GROUP_DOUBLE_ELIMINATION_FORMAT.name} · groups & bracket`}
      backTo={gsdeHref(ROUTE, id)}
      backLabel="Tournament"
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
          <ProgressSummary doc={doc} />
          <LiveMatchesView doc={doc} />
          <EliminationBracketView doc={doc} />
          <GroupMatchesView doc={doc} />
        </>
      ) : null}
    </PageShell>
  );
}
