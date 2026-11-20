import { type ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Crown, GitBranch, Layers, ShieldAlert, Trophy } from "lucide-react";
import type { EliminationMatch, TeamId } from "@/formats/group-double-elimination";
import {
  getGameLabel,
  getGameNumber,
  getWinner,
} from "@/formats/group-double-elimination";
import type { GsdeTournamentDocument } from "@/formats/group-double-elimination/persistence";
import {
  selectCompletion,
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
import { GROUP_TIEBREAKER_LABELS } from "@/formats/group-double-elimination/groupStandings";
import { linkLabel, nameOf, teamNameMap } from "./shared";

const CARD =
  "bg-white/80 backdrop-blur-sm border border-sand-dark/20 shadow-beach";
const CARD_TITLE =
  "text-lg font-bold bg-beach-gradient bg-clip-text text-transparent flex items-center gap-2";

interface ViewsProps {
  doc: GsdeTournamentDocument;
}

interface MatchTeams {
  id: string;
  teamAId: TeamId;
  teamBId: TeamId;
  scoreA?: number | null;
  scoreB?: number | null;
  winnerId?: TeamId | null;
}

/** K&Q-style rank row: orange for first, blue for second, green for third. */
function rankTone(index: number): string {
  if (index === 0) return "bg-sunset-gradient text-white shadow-beach";
  if (index === 1) return "bg-ocean/20 border-2 border-ocean/30 shadow-sand";
  if (index === 2) return "bg-palm/20 border-2 border-palm/30 shadow-sand";
  return "bg-sand-light/60 shadow-sand";
}

function rankText(index: number): string {
  if (index === 0) return "text-white";
  if (index === 1) return "text-ocean";
  if (index === 2) return "text-palm";
  return "text-foreground";
}

function RankRow({
  rank,
  name,
  detail,
  stat,
  index,
}: {
  rank: string | number;
  name: string;
  detail?: string;
  stat?: ReactNode;
  index: number;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 ${rankTone(
        index
      )}`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className={`text-xl font-bold ${rankText(index)}`}>#{rank}</span>
        <div className="min-w-0">
          <p
            className={`truncate font-semibold ${
              index === 0 ? "text-white" : "text-foreground"
            }`}
          >
            {name}
          </p>
          {detail ? (
            <p
              className={`truncate text-xs ${
                index === 0 ? "text-white/75" : "text-foreground/55"
              }`}
            >
              {detail}
            </p>
          ) : null}
        </div>
      </div>
      {stat ? (
        <div
          className={`shrink-0 text-right text-sm font-semibold ${
            index === 0 ? "text-white" : "text-foreground/80"
          }`}
        >
          {stat}
        </div>
      ) : null}
    </div>
  );
}

/** Team row with an ocean/sunset bar and a highlighted winner score. */
function TeamLine({
  name,
  score,
  winner,
  bar,
}: {
  name: string;
  score?: number | null;
  winner: boolean;
  bar: "a" | "b";
}) {
  return (
    <div
      className={`flex items-center gap-2 rounded-lg px-2 py-1 ${
        winner ? "bg-emerald-50/80" : "bg-white/50"
      }`}
    >
      <span
        className={`h-6 w-1 shrink-0 rounded-full ${
          bar === "a" ? "bg-ocean" : "bg-sunset"
        }`}
      />
      <span
        className={`min-w-0 flex-1 truncate text-sm ${
          winner ? "font-bold text-emerald-900" : "text-foreground/80"
        }`}
      >
        {winner ? "👑 " : ""}
        {name}
      </span>
      <span
        className={`tabular-nums text-sm font-bold ${
          winner ? "text-ocean" : "text-foreground/55"
        }`}
      >
        {score ?? "–"}
      </span>
    </div>
  );
}

/** Compact match card used by both live matches and latest results. */
function CompactMatchCard({
  match,
  names,
  label,
  live,
}: {
  match: MatchTeams;
  names: Map<TeamId, string>;
  label: string;
  live: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-2.5 shadow-sand ${
        live
          ? "border-amber-300/60 bg-amber-50/70"
          : "border-sand-dark/20 bg-white/60"
      }`}
    >
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span
          className={`text-xs font-bold ${live ? "text-amber-800" : "text-ocean"}`}
        >
          {label}
        </span>
        <Badge
          variant={live ? "default" : "outline"}
          className={
            live
              ? "bg-amber-100 text-amber-800 hover:bg-amber-100"
              : "border-emerald-300 text-emerald-700"
          }
        >
          {live ? "Awaiting result" : "Final"}
        </Badge>
      </div>
      <div className="space-y-1">
        <TeamLine
          bar="a"
          name={nameOf(names, match.teamAId)}
          score={match.scoreA}
          winner={match.winnerId === match.teamAId}
        />
        <TeamLine
          bar="b"
          name={nameOf(names, match.teamBId)}
          score={match.scoreB}
          winner={match.winnerId === match.teamBId}
        />
      </div>
    </div>
  );
}

/** Group standings, one card per group. All teams show as qualified. */
export function GroupStandingsView({ doc }: ViewsProps) {
  const tables = selectGroupStandings(doc);
  if (tables.length === 0) {
    return <EmptyView text="Groups have not been generated yet." />;
  }
  const names = teamNameMap(doc.teams, doc.registrations ?? []);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {tables.map((table) => {
        const group = doc.groups.find((item) => item.id === table.groupId);
        return (
          <Card key={table.groupId} className={CARD}>
            <CardHeader className="pb-2">
              <CardTitle className={CARD_TITLE}>
                <Layers className="h-5 w-5 text-ocean" />
                {group?.name ?? table.groupId}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 p-3">
              {table.rows.map((row, index) => (
                <RankRow
                  key={row.teamId}
                  index={index}
                  rank={row.rank}
                  name={nameOf(names, row.teamId)}
                  detail={
                    row.tiebreakUsed
                      ? GROUP_TIEBREAKER_LABELS[row.tiebreakUsed]
                      : undefined
                  }
                  stat={
                    <span className="flex items-center gap-2">
                      <span>
                        {row.wins}W · {row.losses}L
                      </span>
                      <span>
                        {row.pointDifference > 0 ? "+" : ""}
                        {row.pointDifference}
                      </span>
                    </span>
                  }
                />
              ))}
              <p className="px-1 pt-1 text-xs text-foreground/55">
                All four teams qualify. Group losses never count as elimination losses.
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

/** All group-stage match results, grouped in compact mobile cards. */
export function GroupMatchesView({ doc }: ViewsProps) {
  if (doc.matches.length === 0) {
    return <EmptyView text="Group matches have not been generated yet." />;
  }
  const names = teamNameMap(doc.teams, doc.registrations ?? []);

  return (
    <Card className={CARD}>
      <CardHeader className="pb-2">
        <CardTitle className={CARD_TITLE}>
          <Layers className="h-5 w-5 text-ocean" />
          Group stage matches
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-3">
        {doc.matches.map((match) => {
          const group = doc.groups.find((item) => item.id === match.groupId);
          return (
            <CompactMatchCard
              key={match.id}
              match={match}
              names={names}
              label={`${group?.name ?? match.groupId} · R${match.round}`}
              live={false}
            />
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
  const names = teamNameMap(doc.teams, doc.registrations ?? []);

  return (
    <Card className={CARD}>
      <CardHeader className="pb-2">
        <CardTitle className={CARD_TITLE}>
          <Trophy className="h-5 w-5 text-ocean" />
          Global group ranking (1–16)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 p-3">
        {ranking.map((row, index) => (
          <RankRow
            key={row.teamId}
            index={index}
            rank={row.globalRank}
            name={nameOf(names, row.teamId)}
            detail={`Group rank #${row.groupRank}`}
            stat={
              <span className="flex items-center gap-2">
                <span>
                  {row.wins}W · {row.losses}L
                </span>
                <span>
                  {row.pointDifference > 0 ? "+" : ""}
                  {row.pointDifference}
                </span>
              </span>
            }
          />
        ))}
      </CardContent>
    </Card>
  );
}

function statusBadge(match: EliminationMatch) {
  if (match.reviewRequired) {
    return (
      <Badge className="bg-rose-100 text-rose-800 hover:bg-rose-100">
        Needs review
      </Badge>
    );
  }
  if (match.status === "completed") {
    return (
      <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
        Done
      </Badge>
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
  const winnerId = getWinner(match);

  return (
    <div className="rounded-xl border border-sand-dark/20 bg-white/60 p-2.5 shadow-sand">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-bold text-ocean">
          {gameLabel}
        </span>
        {statusBadge(match)}
      </div>
      <div className="space-y-1">
        <TeamLine
          bar="a"
          name={nameOf(names, match.teamAId)}
          score={match.scoreA}
          winner={winnerId === match.teamAId}
        />
        <TeamLine
          bar="b"
          name={nameOf(names, match.teamBId)}
          score={match.scoreB}
          winner={winnerId === match.teamBId}
        />
      </div>
      {match.status === "completed" ? (
        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-foreground/55">
          <span>W → {linkLabel(match.winnerTo)}</span>
          <span>L → {linkLabel(match.loserTo)}</span>
        </div>
      ) : null}
      {match.reviewRequired ? (
        <p
          className="mt-1.5 text-[11px] leading-snug text-rose-700"
          title={match.reviewReason ?? "Result invalidated by a score correction."}
        >
          {match.reviewReason ?? "Result invalidated by a score correction."}
        </p>
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
    <Card className={CARD}>
      <CardHeader className="pb-2">
        <CardTitle className={CARD_TITLE}>
          <GitBranch className="h-5 w-5 text-ocean" />
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
  const completion = selectCompletion(doc);

  return (
    <div className="space-y-4">
      <Card className="border-ocean/20 bg-ocean/5 shadow-sm">
        <CardContent className="p-3 text-sm text-foreground/75">
          <strong>Standard 16-team double elimination.</strong> Winners Bracket rounds are
          8 → 4 → 2 → 1; Losers Bracket rounds are 4 → 4 → 2 → 2 → 1 → 1; then one Grand
          Final, plus a reset final only if the undefeated finalist loses the first Grand
          Final. A first loss drops a team to the Losers Bracket; a second loss eliminates it.
        </CardContent>
      </Card>
      {doc.tournament.seedingStale ? (
        <Card className="border-amber-300/60 bg-amber-50/70 shadow-sm">
          <CardContent className="p-3 text-sm text-amber-900">
            <strong>Provisional bracket.</strong> This bracket was seeded from provisional
            group standings. It must be regenerated from the final verified standings.
          </CardContent>
        </Card>
      ) : null}
      {completion.issues.length > 0 ? (
        <Card className="border-amber-300/60 bg-amber-50/70 shadow-sm">
          <CardContent className="p-3 text-sm text-amber-900">
            <strong>Completion blockers:</strong>
            <ul className="mt-1 list-disc pl-5">
              {completion.issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
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
    <Card className={CARD}>
      <CardHeader className="pb-2">
        <CardTitle className={CARD_TITLE}>
          <Trophy className="h-5 w-5 text-ocean" />
          Final placements
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2 p-3 sm:grid-cols-2">
        {placements.map((placement) => (
          <div
            key={placement.place}
            className="flex items-start gap-3 rounded-xl border border-sand-dark/20 bg-white/60 p-2.5 shadow-sand"
          >
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                placement.place === 1
                  ? "bg-sunset-gradient text-white shadow-beach"
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
    <Card className={CARD}>
      <CardHeader className="pb-2">
        <CardTitle className={CARD_TITLE}>
          <ShieldAlert className="h-5 w-5 text-ocean" />
          Elimination status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 p-3">
        {standings.map((row, index) => (
          <RankRow
            key={row.teamId}
            index={index}
            rank={row.rank ?? "–"}
            name={nameOf(names, row.teamId)}
            detail={`${row.wins}W · ${row.losses}L elimination`}
            stat={
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
            }
          />
        ))}
      </CardContent>
    </Card>
  );
}

/** Live (started, awaiting result) matches plus the latest results. */
export function LiveMatchesView({ doc }: ViewsProps) {
  const names = teamNameMap(doc.teams, doc.registrations ?? []);
  const progress = selectProgress(doc);
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
  const tournamentComplete =
    (progress.isComplete || doc.tournament.status === "completed") &&
    liveGroups.length === 0 &&
    liveElimination.length === 0;
  const championName = progress.champion
    ? nameOf(names, progress.champion)
    : null;

  return (
    <div className="space-y-4">
      <Card className={CARD}>
        <CardHeader className="pb-2">
          <CardTitle className={CARD_TITLE}>
            {tournamentComplete ? (
              <Trophy className="h-5 w-5 text-emerald-600" />
            ) : (
              <span className="relative flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500" />
              </span>
            )}
            {tournamentComplete ? "Tournament complete" : "Live matches"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 p-3">
          {tournamentComplete ? (
            <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
              All matches are finished.
              {championName ? <> Champion: <strong>{championName}</strong>.</> : null}{" "}
              See Latest results below.
            </div>
          ) : liveGroups.length === 0 && liveElimination.length === 0 ? (
            <p className="text-sm text-foreground/60">
              No matches are live right now. Started matches awaiting a score appear here.
            </p>
          ) : (
            <>
              {liveGroups.map((match) => (
                <CompactMatchCard
                  key={match.id}
                  match={match}
                  names={names}
                  label={`Group · Round ${match.round}`}
                  live
                />
              ))}
              {liveElimination.map((match) => (
                <CompactMatchCard
                  key={match.id}
                  match={match}
                  names={names}
                  label={
                    getGameNumber(match.id) === null
                      ? match.id
                      : getGameLabel(match.id)
                  }
                  live
                />
              ))}
            </>
          )}
        </CardContent>
      </Card>

      <Card className={CARD}>
        <CardHeader className="pb-2">
          <CardTitle className={CARD_TITLE}>
            <Trophy className="h-5 w-5 text-ocean" />
            Latest results
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 p-3">
          {recentGroups.length === 0 && recentElimination.length === 0 ? (
            <p className="text-sm text-foreground/60">No results have been entered yet.</p>
          ) : (
            <>
              {recentGroups.map((match) => (
                <CompactMatchCard
                  key={match.id}
                  match={match}
                  names={names}
                  label={`Group · R${match.round}`}
                  live={false}
                />
              ))}
              {recentElimination.map((match) => (
                <CompactMatchCard
                  key={match.id}
                  match={match}
                  names={names}
                  label={
                    getGameNumber(match.id) === null
                      ? match.id
                      : getGameLabel(match.id)
                  }
                  live={false}
                />
              ))}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/** Shared explanation that group and elimination rankings never combine. */
export function RankingSystemsNotice() {
  return (
    <Card className="border-ocean/20 bg-ocean/5 shadow-sm">
      <CardContent className="p-3 text-sm text-foreground/75">
        <strong>Two independent rankings.</strong> {GROUP_RANKING_SYSTEM.label} uses{" "}
        {GROUP_RANKING_SYSTEM.source.toLowerCase()}; {ELIMINATION_RANKING_SYSTEM.label}{" "}
        uses {ELIMINATION_RANKING_SYSTEM.source.toLowerCase()}. Group wins/losses are
        never added to elimination wins/losses.
      </CardContent>
    </Card>
  );
}

/** Two independent ranking systems shown side by side, never combined. */
export function IndependentRankingsView({ doc }: ViewsProps) {
  const systems = selectRankingSystems(doc);
  return (
    <div className="space-y-4">
      <RankingSystemsNotice />
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
  const provisional =
    !progress.groups.isComplete ||
    doc.tournament.seedingStale ||
    Boolean(doc.tournament.bracketOverrideUsed);
  return (
    <Card className={`${CARD} p-3`}>
      <div className="flex flex-wrap gap-2 text-xs">
        <Badge variant="secondary" className="bg-ocean/10 text-ocean-dark">
          Groups {progress.groups.completed}/{progress.groups.total}
        </Badge>
        {doc.elimination ? (
          <Badge variant="secondary" className="bg-ocean/10 text-ocean-dark">
            Elimination matches {progress.eliminationComplete}/{progress.eliminationTotal}
          </Badge>
        ) : null}
        {provisional ? (
          <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Provisional</Badge>
        ) : null}
        {progress.resetRequired ? (
          <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Reset required</Badge>
        ) : null}
        {progress.champion ? (
          <Badge
            className={
              progress.isComplete
                ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-100"
                : "bg-amber-100 text-amber-800 hover:bg-amber-100"
            }
          >
            {progress.isComplete ? "Champion" : "Provisional champion"}:{" "}
            {nameOf(teamNameMap(doc.teams, doc.registrations ?? []), progress.champion)}
          </Badge>
        ) : null}
      </div>
      {progress.issues.length > 0 ? (
        <p className="mt-2 text-[11px] text-amber-800" title={progress.issues.join("\n")}>
          {progress.issues.length} completion blocker(s): {progress.issues[0]}
        </p>
      ) : null}
    </Card>
  );
}

function EmptyView({ text }: { text: string }) {
  return (
    <Card className={CARD}>
      <CardContent className="p-6 text-center text-sm text-foreground/60">{text}</CardContent>
    </Card>
  );
}

export const groupMatchLabel = (match: EliminationMatch): string =>
  getGameLabel(match.id);
