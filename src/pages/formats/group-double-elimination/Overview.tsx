import { Fragment, useMemo } from "react";
import {
  AlertCircle,
  ArrowRight,
  ChevronRight,
  CircleCheck,
  Clock,
  Crown,
  GitBranch,
  LayoutDashboard,
  Loader2,
  Map,
  Shield,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { GROUP_DOUBLE_ELIMINATION_FORMAT } from "@/formats";
import {
  buildGsdeOverviewModel,
  resolveOverviewViewerTeamId,
  type GsdeOverviewModel,
  type OverviewBracketMatch,
  type OverviewBracketRound,
  type OverviewGroup,
  type OverviewGroupTeam,
  type OverviewTeamRef,
} from "@/formats/group-double-elimination/overviewModel";
import { GsdePublicShell } from "./PublicShell";
import {
  gsdeHref,
  STATUS_LABEL,
  statusColor,
  useGsdeAuth,
  useGsdeTournament,
} from "./shared";

const ROUTE = GROUP_DOUBLE_ELIMINATION_FORMAT.route;

const initials = (name: string): string => {
  const parts = name.split(/\s+/).filter(Boolean);
  return `${parts[0]?.[0] ?? "?"}${parts[1]?.[0] ?? ""}`.toUpperCase();
};

const scoreText = (a: number | null, b: number | null): string =>
  a === null || b === null ? "– : –" : `${a} : ${b}`;

const teamList = (ids: readonly string[], refs: Map<string, OverviewTeamRef>) =>
  ids.map((id) => refs.get(id)?.name ?? id).join(" / ") || "TBD";

const STATUS_META = {
  completed: {
    label: "Complete",
    icon: CircleCheck,
    className: "border-emerald-300/30 bg-emerald-400/15 text-emerald-200",
  },
  ready: {
    label: "Ready",
    icon: Clock,
    className: "border-[#7E96FF]/40 bg-[#3450D5]/25 text-[#D8E0FF]",
  },
  pending: {
    label: "Pending",
    icon: Clock,
    className: "border-white/15 bg-white/10 text-white/55",
  },
} as const;

function Stat({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: string | number;
  emphasis?: boolean;
}) {
  return (
    <div className="rounded-lg bg-black/20 px-1 py-1">
      <div
        className={cn(
          "font-black leading-none",
          emphasis ? "text-[#F5C451]" : "text-white/90"
        )}
      >
        {value}
      </div>
      <div className="mt-0.5 text-[7px] font-bold uppercase tracking-wide text-white/40">
        {label}
      </div>
    </div>
  );
}

function SummaryTile({
  icon: Icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  sub: string;
  tone: "gold" | "blue";
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-2xl border bg-white/80 px-4 py-3 shadow-sand",
        tone === "gold"
          ? "border-amber-300/60 bg-gradient-to-br from-amber-50 to-white"
          : "border-[#3450D5]/20 bg-gradient-to-br from-[#EEF3FF] to-white"
      )}
    >
      <span
        className={cn(
          "grid h-9 w-9 shrink-0 place-items-center rounded-xl",
          tone === "gold"
            ? "bg-amber-400/20 text-amber-700"
            : "bg-[#3450D5]/10 text-[#3450D5]"
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wide text-foreground/50">
          {label}
        </p>
        <p className="truncate text-base font-black text-foreground">{value}</p>
        <p className="truncate text-[10px] text-foreground/55">{sub}</p>
      </div>
    </div>
  );
}

function OverviewSummary({ model }: { model: GsdeOverviewModel }) {
  const champion = teamList(model.grandFinal.championTeamIds, model.teamRefs);
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <SummaryTile
        icon={Users}
        label="Teams qualified"
        value={`${model.qualifiedCount} / ${model.teamCount}`}
        sub="From live group standings"
        tone="blue"
      />
      <SummaryTile
        icon={LayoutDashboard}
        label="Group matches"
        value={`${model.progress.groups.completed} / ${model.progress.groups.total}`}
        sub="Round-robin completed"
        tone="gold"
      />
      <SummaryTile
        icon={GitBranch}
        label="Elimination games"
        value={`${model.completion.elimination.completed} / ${model.completion.elimination.total}`}
        sub="Winners + Losers + Final"
        tone="blue"
      />
      <SummaryTile
        icon={Crown}
        label="Champion"
        value={champion}
        sub={model.grandFinal.complete ? "Tournament complete" : "Still to be decided"}
        tone="gold"
      />
    </div>
  );
}

function GroupTeamRow({
  team,
  advanceLabel,
}: {
  team: OverviewGroupTeam;
  advanceLabel: string;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border px-2 py-1.5",
        team.isLeader
          ? "border-[#F5C451]/60 bg-[#F5C451]/10"
          : "border-white/10 bg-[#06172F]/70",
        team.isViewerTeam &&
          "ring-2 ring-[#7E96FF] ring-offset-1 ring-offset-[#0A1E39]"
      )}
    >
      <span
        className={cn(
          "absolute bottom-2 left-0 top-2 w-0.5 rounded-full",
          team.isLeader
            ? "bg-[#F5C451]"
            : team.isViewerTeam
              ? "bg-[#7E96FF]"
              : "bg-white/10"
        )}
      />
      <div className="flex items-center gap-1.5 pl-1.5">
        <span
          className={cn(
            "grid h-6 w-6 shrink-0 place-items-center rounded-lg text-[10px] font-black",
            team.isLeader
              ? "bg-[#F5C451] text-[#0A1E39]"
              : "bg-[#3450D5]/25 text-[#CBD6FF]"
          )}
        >
          #{team.rank}
        </span>
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/10 text-[9px] font-black text-white/80">
          {initials(team.name)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <span className="truncate text-[11px] font-bold text-white">
              {team.name}
            </span>
            {team.isViewerTeam ? (
              <span className="shrink-0 rounded-full bg-[#3450D5] px-1.5 py-px text-[7px] font-black uppercase tracking-wide text-white">
                You
              </span>
            ) : null}
          </div>
          <p className="truncate text-[8px] text-white/45">
            {team.players.join(" · ") || "Players TBD"}
          </p>
        </div>
        <span className="text-[11px] font-black text-[#F5C451]">
          {team.wins}-{team.losses}
        </span>
      </div>

      <div className="mt-1.5 grid grid-cols-5 gap-1 pl-1.5">
        <Stat label="MP" value={team.played} />
        <Stat label="W" value={team.wins} emphasis={team.isLeader} />
        <Stat label="L" value={team.losses} />
        <Stat label="PF" value={team.pointsFor} />
        <Stat label="PA" value={team.pointsAgainst} />
      </div>

      <div className="mt-1 flex items-center justify-between gap-2 border-t border-white/10 pt-1 pl-1.5 text-[8px] text-white/45">
        <span className="truncate">
          Global seed {team.globalRank ?? "—"} · {team.entryRound ?? "Bracket pending"}
        </span>
        <span
          className={cn(
            "shrink-0 font-bold",
            team.entryGame ? "text-[#9DB2FF]" : "text-white/30"
          )}
        >
          {team.entryGame ?? advanceLabel}
        </span>
      </div>
    </div>
  );
}

function GroupCard({
  group,
  side,
  advanceLabel,
}: {
  group: OverviewGroup;
  side: "left" | "right";
  advanceLabel: string;
}) {
  return (
    <section
      className={cn(
        "relative rounded-2xl border border-white/10 bg-white/[0.04] p-3 shadow-[0_14px_36px_rgba(0,0,0,0.18)]",
        side === "left" ? "xl:mr-2" : "xl:ml-2"
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "absolute top-1/2 hidden h-px w-4 bg-[#F5C451]/60 xl:block",
          side === "left"
            ? "-right-4 after:absolute after:-right-1 after:-top-[3px] after:border-y-[4px] after:border-l-[6px] after:border-y-transparent after:border-l-[#F5C451]/70 after:content-['']"
            : "-left-4 after:absolute after:-left-1 after:-top-[3px] after:border-y-[4px] after:border-r-[6px] after:border-y-transparent after:border-r-[#F5C451]/70 after:content-['']"
        )}
      />
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-sm font-black uppercase tracking-[0.18em] text-[#F5C451]">
          {group.name}
        </h3>
        <span className="rounded-full border border-[#3450D5]/35 bg-[#3450D5]/20 px-2 py-0.5 text-[9px] font-bold text-[#CBD6FF]">
          {group.qualifiedCount}/{group.totalCount} advance
        </span>
      </div>
      <div className="space-y-1.5">
        {group.teams.length ? (
          group.teams.map((team) => (
            <GroupTeamRow key={team.id} team={team} advanceLabel={advanceLabel} />
          ))
        ) : (
          <p className="rounded-xl border border-dashed border-white/15 px-3 py-5 text-center text-[10px] text-white/40">
            No teams assigned yet
          </p>
        )}
      </div>
    </section>
  );
}

function GroupRail({
  groups,
  side,
  advanceLabel,
}: {
  groups: OverviewGroup[];
  side: "left" | "right";
  advanceLabel: string;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1 text-[9px] font-black uppercase tracking-[0.2em] text-white/40">
        <span>{side === "left" ? "Left side" : "Right side"}</span>
        <span>{groups.map((group) => group.name.replace("Group ", "")).join(" · ")}</span>
      </div>
      {groups.length ? (
        groups.map((group) => (
          <GroupCard
            key={group.id}
            group={group}
            side={side}
            advanceLabel={advanceLabel}
          />
        ))
      ) : (
        <div className="rounded-2xl border border-dashed border-white/15 p-6 text-center text-[10px] text-white/40">
          Groups will appear here once created
        </div>
      )}
    </div>
  );
}

function StatusPill({ match }: { match: OverviewBracketMatch }) {
  const meta = STATUS_META[match.status];
  const Icon = meta.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[8px] font-bold",
        meta.className
      )}
    >
      <Icon className="h-2.5 w-2.5" />
      {match.reviewRequired ? "Review" : meta.label}
    </span>
  );
}

function MatchTeamRow({
  team,
  score,
  isWinner,
  isViewerTeam,
  isEliminated,
}: {
  team: OverviewBracketMatch["teamA"];
  score: number | null;
  isWinner: boolean;
  isViewerTeam: boolean;
  isEliminated: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 rounded-lg px-1.5 py-1",
        isWinner
          ? "bg-[#F5C451]/15 ring-1 ring-[#F5C451]/50"
          : "bg-black/15",
        isViewerTeam && "ring-1 ring-[#7E96FF]"
      )}
    >
      <span
        className={cn(
          "grid h-5 w-5 shrink-0 place-items-center rounded-md text-[8px] font-black",
          isWinner
            ? "bg-[#F5C451] text-[#0A1E39]"
            : "bg-white/10 text-white/70"
        )}
      >
        {initials(team.name)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1">
          <span className="truncate text-[9px] font-bold text-white">
            {team.name}
          </span>
          {isViewerTeam ? (
            <span className="shrink-0 text-[7px] font-black text-[#9DB2FF]">
              YOU
            </span>
          ) : null}
          {isEliminated ? (
            <span className="shrink-0 text-[7px] font-black text-rose-300">
              OUT
            </span>
          ) : null}
        </div>
        <p className="truncate text-[7px] text-white/40">
          {team.players.join(" · ") || "TBD"}
        </p>
      </div>
      <span
        className={cn(
          "text-[11px] font-black tabular-nums",
          isWinner ? "text-[#F5C451]" : "text-white/70"
        )}
      >
        {score ?? "–"}
      </span>
    </div>
  );
}

function BracketMatchCard({
  match,
  variant,
  viewerTeamId,
}: {
  match: OverviewBracketMatch;
  variant: "winners" | "losers";
  viewerTeamId: string | null;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border p-1.5 shadow-[0_10px_24px_rgba(0,0,0,0.2)]",
        variant === "winners"
          ? "border-[#3450D5]/35 bg-[#0B2244]"
          : "border-rose-300/25 bg-[#24152D]"
      )}
    >
      <div className="mb-1 flex items-center justify-between gap-1">
        <span
          className={cn(
            "rounded px-1.5 py-0.5 text-[8px] font-black",
            variant === "winners"
              ? "bg-[#3450D5]/30 text-[#D6DEFF]"
              : "bg-rose-400/20 text-rose-200"
          )}
        >
          {match.gameLabel}
        </span>
        <StatusPill match={match} />
      </div>
      <div className="space-y-1">
        <MatchTeamRow
          team={match.teamA}
          score={match.scoreA}
          isWinner={match.winnerId !== null && match.winnerId === match.teamA.id}
          isViewerTeam={
            match.teamA.id !== null && match.teamA.id === viewerTeamId
          }
          isEliminated={
            variant === "losers" &&
            match.status === "completed" &&
            match.loserId === match.teamA.id &&
            !match.loserTo
          }
        />
        <MatchTeamRow
          team={match.teamB}
          score={match.scoreB}
          isWinner={match.winnerId !== null && match.winnerId === match.teamB.id}
          isViewerTeam={
            match.teamB.id !== null && match.teamB.id === viewerTeamId
          }
          isEliminated={
            variant === "losers" &&
            match.status === "completed" &&
            match.loserId === match.teamB.id &&
            !match.loserTo
          }
        />
      </div>
      <div className="mt-1 flex items-center justify-between gap-2 border-t border-white/10 pt-1 text-[7px] text-white/40">
        <span className="max-w-[72px] truncate" title={match.winnerTo ?? undefined}>
          W {match.winnerTo ?? "—"}
        </span>
        <span className="max-w-[72px] truncate" title={match.loserTo ?? undefined}>
          {variant === "losers" && match.status === "completed" && !match.loserTo
            ? "Eliminated"
            : `L ${match.loserTo ?? "—"}`}
        </span>
      </div>
    </div>
  );
}

function BracketRoundColumn({
  round,
  variant,
  viewerTeamId,
  isLast,
}: {
  round: OverviewBracketRound;
  variant: "winners" | "losers";
  viewerTeamId: string | null;
  isLast: boolean;
}) {
  return (
    <div className="flex w-[158px] shrink-0 flex-col gap-1.5">
      <div
        className={cn(
          "rounded-lg border px-2 py-1 text-center",
          variant === "winners"
            ? "border-[#3450D5]/30 bg-[#3450D5]/15"
            : "border-rose-300/20 bg-rose-400/10"
        )}
      >
        <p
          className={cn(
            "text-[9px] font-black uppercase tracking-wide",
            variant === "winners" ? "text-[#D6DEFF]" : "text-rose-200"
          )}
        >
          {round.label}
        </p>
        <p className="text-[7px] text-white/40">{round.matches.length} games</p>
      </div>
      {round.matches.length ? (
        round.matches.map((match, index) => (
          <Fragment key={match.id}>
            <BracketMatchCard
              match={match}
              variant={variant}
              viewerTeamId={viewerTeamId}
            />
            {index < round.matches.length - 1 ? (
              <span
                aria-hidden="true"
                className="mx-auto h-1.5 w-px bg-[#3450D5]/50"
              />
            ) : null}
          </Fragment>
        ))
      ) : (
        <p className="rounded-lg border border-dashed border-white/10 px-2 py-4 text-center text-[8px] text-white/35">
          Awaiting results
        </p>
      )}
      {!isLast ? (
        <ChevronRight
          aria-hidden="true"
          className="mx-auto h-3 w-3 text-[#F5C451]/60"
        />
      ) : null}
    </div>
  );
}

function BracketSection({
  title,
  subtitle,
  rounds,
  variant,
  viewerTeamId,
  progress,
}: {
  title: string;
  subtitle: string;
  rounds: OverviewBracketRound[];
  variant: "winners" | "losers";
  viewerTeamId: string | null;
  progress: { completed: number; total: number };
}) {
  const Icon = variant === "winners" ? GitBranch : Shield;
  const completed = rounds.reduce(
    (sum, round) =>
      sum + round.matches.filter((match) => match.status === "completed").length,
    0
  );
  const total = rounds.reduce((sum, round) => sum + round.matches.length, 0);

  return (
    <section
      className={cn(
        "rounded-2xl border p-3 shadow-[0_16px_40px_rgba(0,0,0,0.2)]",
        variant === "winners"
          ? "border-[#3450D5]/30 bg-[#071A35]/90"
          : "border-rose-300/20 bg-[#1B1229]/90"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "grid h-7 w-7 shrink-0 place-items-center rounded-lg",
              variant === "winners"
                ? "bg-[#3450D5]/25 text-[#B8C8FF]"
                : "bg-rose-400/20 text-rose-200"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
          </span>
          <div>
            <h3 className="text-xs font-black uppercase tracking-[0.16em] text-white">
              {title}
            </h3>
            <p className="text-[9px] text-white/45">{subtitle}</p>
          </div>
        </div>
        <span className="shrink-0 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[9px] font-bold text-white/60">
          {completed || progress.completed}/{total || progress.total}
        </span>
      </div>

      {rounds.length ? (
        <div className="mt-3 -mx-1 overflow-x-auto px-1 pb-2">
          <div className="flex min-w-max items-start gap-1">
            {rounds.map((round, index) => (
              <BracketRoundColumn
                key={`${round.round}-${round.label}`}
                round={round}
                variant={variant}
                viewerTeamId={viewerTeamId}
                isLast={index === rounds.length - 1}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-3 rounded-xl border border-dashed border-white/15 px-4 py-6 text-center">
          <Sparkles className="mx-auto h-4 w-4 text-white/30" />
          <p className="mt-2 text-[10px] text-white/45">
            Bracket appears when the group stage is verified and seeded
          </p>
        </div>
      )}
    </section>
  );
}

function Finalist({
  label,
  teamId,
  refs,
}: {
  label: string;
  teamId: string | null;
  refs: Map<string, OverviewTeamRef>;
}) {
  const team = teamId ? refs.get(teamId) : undefined;
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 px-3 py-2 text-center">
      <p className="text-[8px] font-black uppercase tracking-[0.18em] text-[#9DB2FF]">
        {label}
      </p>
      <p className="mt-1 truncate text-xs font-black text-white">
        {team?.name ?? (teamId ?? "TBD")}
      </p>
      <p className="truncate text-[8px] text-white/45">
        {team?.players.join(" · ") || "Awaiting qualification"}
      </p>
    </div>
  );
}

function GrandFinalPanel({
  model,
}: {
  model: GsdeOverviewModel;
}) {
  const champion = teamList(model.grandFinal.championTeamIds, model.teamRefs);
  return (
    <section className="relative overflow-hidden rounded-2xl border border-[#F5C451]/45 bg-gradient-to-br from-[#123058] via-[#0A1E39] to-[#0C2A50] p-4 shadow-[0_20px_60px_rgba(245,196,81,0.12)]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-10 -top-14 h-40 w-40 rounded-full bg-[#F5C451]/10 blur-3xl"
      />
      <div className="relative flex items-center justify-center gap-2">
        <Crown className="h-4 w-4 text-[#F5C451]" />
        <h3 className="text-sm font-black uppercase tracking-[0.28em] text-[#F5C451]">
          Grand Final
        </h3>
        <Crown className="h-4 w-4 text-[#F5C451]" />
      </div>
      <p className="relative mt-1 text-center text-[9px] text-white/50">
        Undefeated champion vs Last-chance champion
      </p>

      <div className="relative mt-3 grid gap-2 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
        <Finalist
          label="Winners bracket"
          teamId={model.grandFinal.winnersChampionId}
          refs={model.teamRefs}
        />
        <span className="text-center text-[10px] font-black text-white/35">VS</span>
        <Finalist
          label="Losers bracket"
          teamId={model.grandFinal.losersChampionId}
          refs={model.teamRefs}
        />
      </div>

      <div className="relative mt-3 space-y-2">
        {model.grandFinal.matches.length ? (
          model.grandFinal.matches.map((match) => (
            <div
              key={match.id}
              className="rounded-xl border border-[#F5C451]/20 bg-black/25 px-3 py-2"
            >
              <div className="flex items-center justify-between text-[8px] font-bold uppercase tracking-wide text-[#F5C451]">
                <span>{match.gameLabel}</span>
                <StatusPill match={match} />
              </div>
              <div className="mt-2 flex items-center justify-center gap-3">
                <span className="max-w-[35%] truncate text-[10px] font-bold text-white/80">
                  {match.teamA.name}
                </span>
                <span className="text-xl font-black tabular-nums text-[#F5C451]">
                  {scoreText(match.scoreA, match.scoreB)}
                </span>
                <span className="max-w-[35%] truncate text-[10px] font-bold text-white/80">
                  {match.teamB.name}
                </span>
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-xl border border-dashed border-[#F5C451]/20 px-3 py-4 text-center text-[10px] text-white/45">
            Final match will appear here once both finalists are known
          </div>
        )}
      </div>

      <div className="relative mt-3 flex items-center justify-center gap-2 rounded-xl bg-[#F5C451]/10 px-3 py-2 text-center">
        <Trophy className="h-3.5 w-3.5 shrink-0 text-[#F5C451]" />
        <p className="truncate text-[10px] font-bold text-[#F5C451]">
          {model.grandFinal.complete
            ? `Champion · ${champion}`
            : "Champion to be decided"}
        </p>
      </div>
      {model.grandFinal.resetRequired && !model.grandFinal.resetWasPlayed ? (
        <p className="relative mt-2 text-center text-[9px] text-amber-200/80">
          Reset final required if the Losers champion wins the first final
        </p>
      ) : null}
    </section>
  );
}

function SeedFeed({ model }: { model: GsdeOverviewModel }) {
  return (
    <div className="rounded-xl border border-[#F5C451]/20 bg-[#F5C451]/[0.06] px-3 py-2">
      <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[9px] font-bold text-[#F5C451]">
        {model.groups.length ? (
          <>
            {model.groups.map((group) => (
              <span key={group.id} className="inline-flex items-center gap-1">
                {group.name}
                <ArrowRight className="h-2.5 w-2.5" />
              </span>
            ))}
            <span className="text-white/60">seeded into the Winners Bracket</span>
          </>
        ) : (
          <span className="text-white/60">
            Group seeds appear here once teams are assigned
          </span>
        )}
      </div>
      <p className="mt-1 text-center text-[8px] text-white/40">
        {model.groups.length === 0
          ? "No group stage data yet"
          : model.advanceAllTeams
            ? `All ${model.qualifiedCount} group teams advance · canonical bracket seeds`
            : `${model.qualifiedCount} qualified teams advance · canonical bracket seeds`}
      </p>
    </div>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[8px] text-white/45">
      <span className="inline-flex items-center gap-1">
        <span className="h-2 w-2 rounded-full bg-[#F5C451]" /> Group leader / winner
      </span>
      <span className="inline-flex items-center gap-1">
        <span className="h-2 w-2 rounded-full bg-[#7E96FF]" /> Your team
      </span>
      <span className="inline-flex items-center gap-1">
        <span className="h-2 w-2 rounded-full bg-rose-300" /> Eliminated
      </span>
    </div>
  );
}

/** Dynamic, data-driven map of the whole GSDE tournament. */
export default function GroupDoubleEliminationOverview() {
  const { id, doc, loading, error } = useGsdeTournament();
  const { user } = useGsdeAuth();
  const viewerTeamId = useMemo(
    () => (doc ? resolveOverviewViewerTeamId(doc, user?.uid, user?.email) : null),
    [doc, user]
  );
  const model = useMemo(
    () => (doc ? buildGsdeOverviewModel(doc, viewerTeamId) : null),
    [doc, viewerTeamId]
  );
  const advanceLabel = model?.advanceAllTeams ? "Advances" : "Qualifies";

  return (
    <GsdePublicShell
      emoji="🗺️"
      title="Tournament Overview"
      subtitle={`${GROUP_DOUBLE_ELIMINATION_FORMAT.name} · groups, brackets & final`}
      backTo={gsdeHref(ROUTE, id)}
      backLabel="Tournament"
      wide
      badge={
        model ? (
          <span
            className={cn(
              "inline-block rounded-full px-3 py-1 text-xs font-bold",
              statusColor(doc!.tournament.status)
            )}
          >
            {STATUS_LABEL[doc!.tournament.status]}
          </span>
        ) : null
      }
    >
      {loading ? (
        <Card className="border border-sand-dark/20 bg-white/80 shadow-beach">
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
      ) : doc && model ? (
        <>
          <OverviewSummary model={model} />

          <div className="relative overflow-hidden rounded-[28px] border border-[#3450D5]/25 bg-[#0A1E39] p-3 shadow-[0_24px_80px_rgba(10,30,57,0.35)] sm:p-5">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 opacity-[0.18]"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(52,80,213,0.35) 1px, transparent 1px), linear-gradient(90deg, rgba(52,80,213,0.35) 1px, transparent 1px)",
                backgroundSize: "42px 42px",
              }}
            />
            <div className="relative mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-white">
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-[#3450D5]/25 text-[#BFD0FF]">
                  <Map className="h-4 w-4" />
                </span>
                <div>
                  <h2 className="text-sm font-black uppercase tracking-[0.2em]">
                    Tournament map
                  </h2>
                  <p className="text-[9px] text-white/45">
                    Live from the group stage through the Grand Final
                  </p>
                </div>
              </div>
              <Legend />
            </div>

            <div className="relative grid gap-4 xl:grid-cols-[minmax(210px,0.9fr)_minmax(0,2.2fr)_minmax(210px,0.9fr)]">
              <div className="order-1 xl:order-none xl:col-start-1 xl:row-start-1">
                <GroupRail
                  groups={model.leftGroups}
                  side="left"
                  advanceLabel={advanceLabel}
                />
              </div>
              <div className="order-3 min-w-0 space-y-3 xl:order-none xl:col-start-2 xl:row-start-1">
                <SeedFeed model={model} />
                <BracketSection
                  title="Winners Bracket"
                  subtitle="Undefeated path · first loss drops to Losers"
                  rounds={model.winnersRounds}
                  variant="winners"
                  viewerTeamId={viewerTeamId}
                  progress={model.completion.elimination}
                />
                <div className="flex items-center justify-center gap-2 text-[9px] font-bold text-[#9DB2FF]">
                  <ArrowRight className="h-3 w-3 rotate-90" />
                  First loss drops down · second loss eliminates
                </div>
                <BracketSection
                  title="Losers Bracket"
                  subtitle="One loss already · win or go home"
                  rounds={model.losersRounds}
                  variant="losers"
                  viewerTeamId={viewerTeamId}
                  progress={model.completion.elimination}
                />
                <div className="flex items-center justify-center">
                  <ArrowRight className="h-4 w-4 rotate-90 text-[#F5C451]" />
                </div>
                <GrandFinalPanel model={model} />
              </div>
              <div className="order-2 xl:order-none xl:col-start-3 xl:row-start-1">
                <GroupRail
                  groups={model.rightGroups}
                  side="right"
                  advanceLabel={advanceLabel}
                />
              </div>
            </div>
          </div>
        </>
      ) : null}
    </GsdePublicShell>
  );
}
