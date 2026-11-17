import { CalendarDays, GitBranch, Info as InfoIcon, UserPlus, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GROUP_DOUBLE_ELIMINATION_FORMAT } from "@/formats";
import { PageShell, gsdeHref, useGsdeTournament } from "./shared";
import { TournamentRulesView } from "./views";

const ROUTE = GROUP_DOUBLE_ELIMINATION_FORMAT.route;

/** Public info: how the format works, registration and the full rule set. */
export default function GroupDoubleEliminationInfo() {
  const { id, doc } = useGsdeTournament();
  const config = doc?.tournament.config;

  return (
    <PageShell
      title="Info"
      subtitle={`${GROUP_DOUBLE_ELIMINATION_FORMAT.name} · how it works`}
      backTo={gsdeHref(ROUTE, id)}
      backLabel="Tournament"
    >
      <Card className="border-ocean/20 bg-ocean/5 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <InfoIcon className="h-4 w-4 text-ocean" />
            {config?.name || GROUP_DOUBLE_ELIMINATION_FORMAT.name}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-foreground/75">
          <p>{GROUP_DOUBLE_ELIMINATION_FORMAT.description}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-foreground/60">
            <span className="inline-flex items-center gap-1">
              <Users className="h-3.5 w-3.5" /> {config?.teamLimit ?? 16} teams
            </span>
            <span className="inline-flex items-center gap-1">
              <GitBranch className="h-3.5 w-3.5" /> {config?.groupCount ?? 4} groups of{" "}
              {config?.teamsPerGroup ?? 4}
            </span>
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="h-3.5 w-3.5" />{" "}
              {config?.date || "Date to be confirmed"}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card className="border-sand-dark/40 shadow-beach bg-card/95">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-ocean" />
            Player registration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm text-foreground/75">
          <p>
            Players register individually with an account from the Player page.
            An admin approves each registration and assigns the player to a team.
          </p>
          <p className="text-foreground/60">
            Registrations are stored only in this tournament document. King &amp;
            Queen data is never touched.
          </p>
        </CardContent>
      </Card>

      <TournamentRulesView />
    </PageShell>
  );
}
