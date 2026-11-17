import { AlertCircle, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { GROUP_DOUBLE_ELIMINATION_FORMAT } from "@/formats";
import { PageShell, gsdeHref, useGsdeTournament } from "./shared";
import {
  GlobalRankingView,
  IndependentRankingsView,
  ProgressSummary,
} from "./views";

const ROUTE = GROUP_DOUBLE_ELIMINATION_FORMAT.route;

/** Public ranking: the seeding order plus the two independent ranking systems. */
export default function GroupDoubleEliminationRanking() {
  const { id, doc, loading, error } = useGsdeTournament();

  return (
    <PageShell
      title="Live Ranking"
      subtitle={`${GROUP_DOUBLE_ELIMINATION_FORMAT.name} · group & elimination rankings`}
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
          <GlobalRankingView doc={doc} />
          <IndependentRankingsView doc={doc} />
        </>
      ) : null}
    </PageShell>
  );
}
