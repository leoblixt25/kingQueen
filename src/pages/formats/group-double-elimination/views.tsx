import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Crown,
  GitBranch,
  Layers,
  ShieldAlert,
  Trophy,
} from "lucide-react";
import type { EliminationMatch, TeamId } from "@/formats/group-double-elimination";
import { getGameLabel, getGameNumber } from "@/formats/group-double-elimination";
import type { GsdeTournamentDocument } from "@/formats/group-double-elimination/persistence";
import {
  selectEliminationStandings,
  selectGlobalRanking,
  selectGroupStandings,
  selectPlacements,
  selectProgress,
} from "@/formats/group-double-elimination/scoring";
import {
  ELIMINATION_RANKING_SYSTEM,
  GROUP_RANKING_SYSTEM,
  selectRankingSystems,
} from "@/formats/group-double-elimination/rankingSystems";
import { linkLabel, nameOf, teamNameMap } from "./shared";

const th = "px-2 py-1.5 text-left text-xs font-semibold text-foreground/60";
const td = "px-2 py-1.5 text-sm text-foreground/85";

interface ViewsProps {
  doc: GsdeTournamentDocument;
}

/** Group standings, one table per group. All teams show as qualified. */
export function GroupStandingsView({ doc }: ViewsProps) {
  const tables = selectGroupStandings(doc);
  if (tables.length === 0) {
    return <EmptyView text="Groups have not been generated yet." />;
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {tables.map((table) => {
        const group = doc.groups.find((item) => item.id === table.groupId);
        return (
          <Card key={table.groupId} className="border-sand-dark/40 shadow-beach bg-card/95">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Layers className="h-4 w-4 text-ocean" />
                {group?.name ?? table.groupId}
              </CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto p-2">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-sand-dark/30">
                    <th className={th}>#</th>
                    <th className={th}>Team</th>
                    <th className={th}>P</th>
                    <th className={th}>W</th>
                    <th className={th}>L</th>
                    <th className={th}>+/−</th>
                  </tr>
                </thead>
                <tbody>
                  {table.rows.map((row) => (
                    <tr key={row.teamId} className="border-b border-sand-dark/15 last:border-0">
                      <td className={td}>{row.rank}</td>
                      <td className={`${td} font-semibold`}>
                        {nameOf(teamNameMap(doc.teams, doc.registrations ?? []), row.teamId)}
                      </td>
                      <td className={td}>{row.played}</td>
                      <td className={td}>{row.wins}</td>
                      <td className={td}>{row.losses}</td>
                      <td className={td}>
                        {row.pointDifference > 0 ? "+" : ""}
                        {row.pointDifference}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 px-2 text-xs text-foreground/55">
                All four teams qualify. Group losses never count as elimination losses.
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

/** All 24 group-stage match results, grouped by group. */
export function GroupMatchesView({ doc }: ViewsProps) {
  if (doc.matches.length === 0) {
    return <EmptyView text="Group matches have not been generated yet." />;
  }
  const names = teamNameMap(doc.teams, doc.registrations ?? []);

  return (
    <Card className="border-sand-dark/40 shadow-beach bg-card/95">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Layers className="h-4 w-4 text-ocean" />
          Group stage matches
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-3">
        {doc.matches.map((match) => {
          const complete = match.status === "completed";
          const group = doc.groups.find((item) => item.id === match.groupId);
          return (
            <div
              key={match.id}
              className="rounded-lg border border-sand-dark/25 bg-white/60 p-2 text-sm"
            >
              <div className="mb-1 flex items-center justify-between text-[11px] text-foreground/50">
                <span>{group?.name ?? match.groupId} · R{match.round}</span>
                <span>{complete ? "Final" : "Pending"}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span
                  className={
                    match.winnerId === match.teamAId
                      ? "font-bold text-emerald-800"
                      : "text-foreground/80"
                  }
                >
                  {nameOf(names, match.teamAId)}
                </span>
                <span className="tabular-nums font-semibold">
                  {match.scoreA ?? "–"} : {match.scoreB ?? "–"}
                </span>
                <span
                  className={
                    match.winnerId === match.teamBId
                      ? "font-bold text-emerald-800"
                      : "text-foreground/80"
                  }
                >
                  {nameOf(names, match.teamBId)}
                </span>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

/** Global 1–16 group ranking used to seed the elimination bracket. */
export function GlobalRankingView({ doc }: ViewsProps) {
  const ranking = selectGlobalRanking(doc);
  if (ranking.length === 0) {
    return <EmptyView text="Play group matches to build the global ranking." />;
  }

  return (
    <Card className="border-sand-dark/40 shadow-beach bg-card/95">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Trophy className="h-4 w-4 text-ocean" />
          Global group ranking (1–16)
        </CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto p-2">
        <table className="min-w-full">
          <thead>
            <tr className="border-b border-sand-dark/30">
              <th className={th}>Seed</th>
              <th className={th}>Team</th>
              <th className={th}>Group</th>
              <th className={th}>W</th>
              <th className={th}>L</th>
              <th className={th}>+/−</th>
            </tr>
          </thead>
          <tbody>
            {ranking.map((row) => (
              <tr key={row.teamId} className="border-b border-sand-dark/15 last:border-0">
                <td className={`${td} font-bold text-ocean`}>{row.globalRank}</td>
                <td className={`${td} font-semibold`}>
                  {nameOf(teamNameMap(doc.teams, doc.registrations ?? []), row.teamId)}
                </td>
                <td className={td}>#{row.groupRank}</td>
                <td className={td}>{row.wins}</td>
                <td className={td}>{row.losses}</td>
                <td className={td}>
                  {row.pointDifference > 0 ? "+" : ""}
                  {row.pointDifference}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function statusBadge(match: EliminationMatch) {
  if (match.status === "completed") {
    return (
      <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Done</Badge>
    );
  }
  if (match.status === "ready") {
    return <Badge variant="secondary">Ready</Badge>;
  }
  return (
    <Badge variant="outline" className="text-foreground/50">
      Pending
    </Badge>
  );
}

function EliminationMatchRow({
  match,
  names,
}: {
  match: EliminationMatch;
  names: Map<TeamId, string>;
}) {
  const gameNumber = getGameNumber(match.id);
  const gameLabel = gameNumber === null ? match.id : `Game ${gameNumber}`;
  const promoted = gameNumber === 27 || gameNumber === 28;

  return (
    <div className="rounded-xl border border-sand-dark/30 bg-white/60 p-2.5">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span
          className={`text-xs font-bold ${
            promoted ? "text-amber-700" : "text-ocean"
          }`}
        >
          {gameLabel}
          {promoted ? " · Spanish semi" : ""}
        </span>
        {statusBadge(match)}
      </div>
      {[match.teamAId, match.teamBId].map((teamId, index) => {
        const score = index === 0 ? match.scoreA : match.scoreB;
        const isWinner = match.winnerId !== null && match.winnerId === teamId;
        return (
          <div
            key={`${match.id}-slot-${index}`}
            className={`flex items-center justify-between gap-2 rounded-md px-1.5 py-0.5 text-sm ${
              isWinner ? "bg-emerald-50 font-semibold text-emerald-900" : "text-foreground/80"
            }`}
          >
            <span className="flex items-center gap-1 truncate">
              {isWinner ? <Crown className="h-3.5 w-3.5 text-amber-500" /> : null}
              {nameOf(names, teamId)}
            </span>
            <span className="tabular-nums">{score ?? "–"}</span>
          </div>
        );
      })}
      {match.status === "completed" ? (
        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-foreground/55">
          <span>W → {linkLabel(match.winnerTo)}</span>
          <span>L → {linkLabel(match.loserTo)}</span>
        </div>
      ) : null}
    </div>
  );
}

function BracketColumn({
  title,
  matches,
  names,
}: {
  title: string;
  matches: EliminationMatch[];
  names: Map<TeamId, string>;
}) {
  const rounds = [...new Set(matches.map((match) => match.round))].sort(
    (a, b) => a - b
  );
  return (
    <Card className="border-sand-dark/40 shadow-beach bg-card/95">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <GitBranch className="h-4 w-4 text-ocean" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 p-3">
        {rounds.map((round) => (
          <div key={round}>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-foreground/50">
              Round {round}
            </p>
            <div className="grid gap-2">
              {matches
                .filter((match) => match.round === round)
                .sort((a, b) => a.index - b.index)
                .map((match) => (
                  <EliminationMatchRow key={match.id} match={match} names={names} />
                ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/** Winners / Losers / Grand Final brackets with game numbers and progression. */
export function EliminationBracketView({ doc }: ViewsProps) {
  const bracket = doc.elimination;
  if (!bracket) {
    return <EmptyView text="The double-elimination bracket has not been generated yet." />;
  }
  const names = teamNameMap(doc.teams, doc.registrations ?? []);

  return (
    <div className="space-y-4">
      <Card className="border-amber-300/60 bg-amber-50/70 shadow-sm">
        <CardContent className="p-3 text-sm text-amber-900">
          <strong>Spanish crossover:</strong> Game 27 pits the winners of Games 25 &amp; 22, and Game 28
          pits the winners of Games 26 &amp; 21. Both semifinal winners reach the Grand Final; the losers
          meet for 3rd place. A reset (Game 31) is used only when an undefeated finalist loses Game 30.
        </CardContent>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <BracketColumn title="Winners bracket" matches={bracket.winners} names={names} />
        <BracketColumn title="Losers bracket" matches={bracket.losers} names={names} />
      </div>
      <BracketColumn title="Grand Final" matches={bracket.grandFinal} names={names} />
    </div>
  );
}

/** Final placements 1–16, sharing places when teams are tied. */
export function PlacementsView({ doc }: ViewsProps) {
  const placements = selectPlacements(doc);
  if (placements.length === 0) {
    return <EmptyView text="Final placements appear once the bracket is complete." />;
  }
  const names = teamNameMap(doc.teams, doc.registrations ?? []);

  return (
    <Card className="border-sand-dark/40 shadow-beach bg-card/95">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Trophy className="h-4 w-4 text-ocean" />
          Final placements
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2 p-3 sm:grid-cols-2">
        {placements.map((placement) => (
          <div
            key={placement.place}
            className="flex items-start gap-3 rounded-xl border border-sand-dark/25 bg-white/60 p-2.5"
          >
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                placement.place === 1
                  ? "bg-amber-400 text-white"
                  : "bg-ocean/10 text-ocean"
              }`}
            >
              {placement.place}
            </span>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {placement.teamIds.length > 1 ? (
                <span className="mr-1 text-xs font-semibold text-amber-700">Tied</span>
              ) : null}
              {placement.teamIds.map((teamId) => (
                <span key={teamId} className="text-sm font-medium text-foreground/85">
                  {nameOf(names, teamId)}
                </span>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/** Live elimination status: wins, losses, alive/eliminated. */
export function EliminationStandingsView({ doc }: ViewsProps) {
  const standings = selectEliminationStandings(doc);
  if (standings.length === 0) {
    return <EmptyView text="Elimination standings appear once the bracket starts." />;
  }
  const names = teamNameMap(doc.teams, doc.registrations ?? []);

  return (
    <Card className="border-sand-dark/40 shadow-beach bg-card/95">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-ocean" />
          Elimination status
        </CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto p-2">
        <table className="min-w-full">
          <thead>
            <tr className="border-b border-sand-dark/30">
              <th className={th}>Team</th>
              <th className={th}>W</th>
              <th className={th}>L</th>
              <th className={th}>Status</th>
              <th className={th}>Place</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((row) => (
              <tr key={row.teamId} className="border-b border-sand-dark/15 last:border-0">
                <td className={`${td} font-semibold`}>{nameOf(names, row.teamId)}</td>
                <td className={td}>{row.wins}</td>
                <td className={td}>{row.losses}</td>
                <td className={td}>
                  <Badge
                    variant={row.status === "champion" ? "default" : "outline"}
                    className={
                      row.status === "eliminated"
                        ? "text-foreground/55"
                        : row.status === "champion"
                          ? "bg-amber-400 text-white hover:bg-amber-400"
                          : ""
                    }
                  >
                    {row.status}
                  </Badge>
                </td>
                <td className={td}>{row.rank ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

/** Live (started, awaiting result) matches plus the latest results. */
export function LiveMatchesView({ doc }: ViewsProps) {
  const names = teamNameMap(doc.teams, doc.registrations ?? []);
  const liveGroups = doc.matches.filter((match) => match.status === "ready");
  const liveElimination = doc.elimination
    ? [...doc.elimination.winners, ...doc.elimination.losers, ...doc.elimination.grandFinal].filter(
        (match) => match.status === "ready"
      )
    : [];
  const recentGroups = doc.matches
    .filter((match) => match.status === "completed")
    .slice(-6)
    .reverse();
  const recentElimination = doc.elimination
    ? [...doc.elimination.winners, ...doc.elimination.losers, ...doc.elimination.grandFinal]
        .filter((match) => match.status === "completed")
        .sort(
          (a, b) =>
            (getGameNumber(b.id) ?? 0) - (getGameNumber(a.id) ?? 0)
        )
        .slice(0, 6)
    : [];

  const liveRow = (match: EliminationMatch) => (
    <div
      key={match.id}
      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-300/50 bg-amber-50/70 px-2.5 py-1.5 text-sm"
    >
      <span className="text-xs font-semibold text-amber-800">
        {getGameNumber(match.id) === null ? match.id : getGameLabel(match.id)}
      </span>
      <span className="flex-1 text-foreground/80">
        {nameOf(names, match.teamAId)} vs {nameOf(names, match.teamBId)}
      </span>
      <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Awaiting result</Badge>
    </div>
  );

  return (
    <div className="space-y-4">
      <Card className="border-sand-dark/40 shadow-beach bg-card/95">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
            </span>
            Live matches
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5">
          {liveGroups.length === 0 && liveElimination.length === 0 ? (
            <p className="text-sm text-foreground/60">
              No matches are live right now. Started matches awaiting a score appear here.
            </p>
          ) : (
            <>
              {liveGroups.map((match) => (
                <div
                  key={match.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-300/50 bg-amber-50/70 px-2.5 py-1.5 text-sm"
                >
                  <span className="text-xs font-semibold text-amber-800">
                    Group · Round {match.round}
                  </span>
                  <span className="flex-1 text-foreground/80">
                    {nameOf(names, match.teamAId)} vs {nameOf(names, match.teamBId)}
                  </span>
                  <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
                    Awaiting result
                  </Badge>
                </div>
              ))}
              {liveElimination.map(liveRow)}
            </>
          )}
        </CardContent>
      </Card>

      <Card className="border-sand-dark/40 shadow-beach bg-card/95">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Latest results</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5">
          {recentGroups.length === 0 && recentElimination.length === 0 ? (
            <p className="text-sm text-foreground/60">No results have been entered yet.</p>
          ) : (
            <>
              {recentGroups.map((match) => (
                <div
                  key={match.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-sand-dark/25 bg-white/60 px-2.5 py-1.5 text-sm"
                >
                  <span className="text-xs text-foreground/55">Group · R{match.round}</span>
                  <span className="flex-1 text-foreground/80">
                    {nameOf(names, match.teamAId)} {match.scoreA} : {match.scoreB}{" "}
                    {nameOf(names, match.teamBId)}
                  </span>
                  <Badge variant="outline" className="border-emerald-300 text-emerald-700">
                    Final
                  </Badge>
                </div>
              ))}
              {recentElimination.map((match) => (
                <div
                  key={match.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-sand-dark/25 bg-white/60 px-2.5 py-1.5 text-sm"
                >
                  <span className="text-xs font-semibold text-ocean">
                    {getGameNumber(match.id) === null ? match.id : getGameLabel(match.id)}
                  </span>
                  <span className="flex-1 text-foreground/80">
                    {nameOf(names, match.teamAId)} {match.scoreA} : {match.scoreB}{" "}
                    {nameOf(names, match.teamBId)}
                  </span>
                  <Badge variant="outline" className="border-emerald-300 text-emerald-700">
                    Final
                  </Badge>
                </div>
              ))}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/** Format rules, kept in one place so public/player/admin can link to them. */
export function TournamentRulesView() {
  const rules: { title: string; body: string }[] = [
    {
      title: "Teams and groups",
      body: "16 teams are split into 4 groups of 4 by seed using a snake distribution. Every team plays a single-set round robin inside its group (6 matches per team, 24 group matches in total).",
    },
    {
      title: "Group standings & tiebreakers",
      body: "Group ranking uses wins, then head-to-head, then point difference, then points scored, then team id. All four teams in each group qualify.",
    },
    {
      title: "No group eliminations",
      body: "Group losses never count as elimination losses. A team that loses all three group matches still enters the bracket with zero elimination losses.",
    },
    {
      title: "Elimination bracket",
      body: "The global group ranking seeds a 16-team double-elimination bracket. A first elimination loss drops a team to the Losers Bracket; a second loss eliminates it.",
    },
    {
      title: "Spanish crossover",
      body: "Spanish crossover: Game 25 meets the Game 22 winner and Game 26 meets the Game 21 winner in the semifinals (Games 27–28). Both semifinal winners reach the Grand Final. Semifinal losers meet for 3rd/4th; that lower final does not feed the Grand Final.",
    },
    {
      title: "Grand Final reset",
      body: "If the undefeated finalist loses the first Grand Final, a reset final is played to decide the champion.",
    },
    {
      title: "Two independent rankings",
      body: "Group standings and elimination standings are calculated separately. Group wins are never added to elimination wins. Final tied places are shared; no artificial tiebreakers are invented.",
    },
  ];

  return (
    <Card className="border-sand-dark/40 shadow-beach bg-card/95">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Tournament rules</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {rules.map((rule) => (
          <div key={rule.title}>
            <h4 className="text-sm font-semibold text-ocean">{rule.title}</h4>
            <p className="text-sm text-foreground/75">{rule.body}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/** Two independent ranking systems shown side by side, never combined. */
export function IndependentRankingsView({ doc }: ViewsProps) {
  const systems = selectRankingSystems(doc);
  return (
    <div className="space-y-4">
      <Card className="border-ocean/20 bg-ocean/5 shadow-sm">
        <CardContent className="p-3 text-sm text-foreground/75">
          <strong>Two independent rankings.</strong> {GROUP_RANKING_SYSTEM.label} uses{" "}
          {GROUP_RANKING_SYSTEM.source.toLowerCase()}; {ELIMINATION_RANKING_SYSTEM.label}{" "}
          uses {ELIMINATION_RANKING_SYSTEM.source.toLowerCase()}. Group wins/losses are
          never added to elimination wins/losses.
        </CardContent>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wide text-ocean">
            {GROUP_RANKING_SYSTEM.label}
          </h3>
          <GroupStandingsView doc={doc} />
          <GlobalRankingView doc={doc} />
          {systems.group.tables.length === 0 ? (
            <EmptyView text="Group standings appear once groups are generated." />
          ) : null}
        </div>
        <div className="space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wide text-ocean">
            {ELIMINATION_RANKING_SYSTEM.label}
          </h3>
          <EliminationStandingsView doc={doc} />
          <PlacementsView doc={doc} />
          {systems.elimination.standings.length === 0 ? (
            <EmptyView text="Elimination standings appear once the bracket starts." />
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** Small progress summary used at the top of both pages. */
export function ProgressSummary({ doc }: ViewsProps) {
  const progress = selectProgress(doc);
  return (
    <div className="flex flex-wrap gap-2 text-xs">
      <Badge variant="secondary">
        Groups {progress.groups.completed}/{progress.groups.total}
      </Badge>
      {doc.elimination ? (
        <Badge variant="secondary">
          Elimination matches {progress.eliminationComplete}/30
        </Badge>
      ) : null}
      {progress.resetRequired ? (
        <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Reset required</Badge>
      ) : null}
      {progress.champion ? (
        <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
          Champion: {nameOf(teamNameMap(doc.teams, doc.registrations ?? []), progress.champion)}
        </Badge>
      ) : null}
    </div>
  );
}

function EmptyView({ text }: { text: string }) {
  return (
    <Card className="border-sand-dark/40 shadow-beach bg-card/95">
      <CardContent className="p-6 text-center text-sm text-foreground/60">{text}</CardContent>
    </Card>
  );
}

export const groupMatchLabel = (match: EliminationMatch): string =>
  getGameLabel(match.id);
