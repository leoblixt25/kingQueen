import { useEffect, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type { BracketLink, GsdeTournamentStatus, Team, TeamId } from "@/formats/group-double-elimination";
import { getGameLabel } from "@/formats/group-double-elimination";
import {
  createGsdeTournamentDocument,
  subscribeGsdeTournament,
  type GsdeTournamentDocument,
} from "@/formats/group-double-elimination/persistence";
import {
  currentAuthUser,
  subscribeAuthUser,
  type User,
} from "@/formats/group-double-elimination/registrationAuth";
import { ArrowLeft } from "lucide-react";
import { GROUP_DOUBLE_ELIMINATION_FORMAT } from "@/formats";

/** Default document used when no `?id=` is supplied. */
export const DEFAULT_GSDE_TOURNAMENT_ID = "default";

/** Builds a GSDE route that preserves the selected tournament id. */
export const gsdeHref = (route: string, id: string): string =>
  id === DEFAULT_GSDE_TOURNAMENT_ID
    ? route
    : `${route}?id=${encodeURIComponent(id)}`;

/** K&Q-style gradient title, branded for the group-stage format. */
export function GsdeMainTitle() {
  return (
    <h1 className="font-bold text-2xl sm:text-3xl md:text-3xl lg:text-4xl leading-tight tracking-wide">
      <span className="bg-gradient-to-r from-ocean via-sunset to-coral bg-clip-text text-transparent drop-shadow-sm">
        Group Stage
      </span>{" "}
      <span className="text-lg sm:text-xl md:text-xl lg:text-2xl text-foreground/80">
        + Double Elimination
      </span>
    </h1>
  );
}

/**
 * Subscribes to a single isolated `tournaments/{id}` document. When the
 * document does not exist yet, callers receive a fresh local draft that any
 * save will create. All writes stay inside the persistence module.
 */
export function useGsdeTournament() {
  const [searchParams, setSearchParams] = useSearchParams();
  const id = searchParams.get("id")?.trim() || DEFAULT_GSDE_TOURNAMENT_ID;
  const [doc, setDoc] = useState<GsdeTournamentDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const unsubscribe = subscribeGsdeTournament(
      id,
      (data) => {
        setDoc(data ?? createGsdeTournamentDocument(id));
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );
    return unsubscribe;
  }, [id]);

  const setId = (nextId: string) => {
    const clean = nextId.trim();
    const params = new URLSearchParams(searchParams);
    if (clean && clean !== DEFAULT_GSDE_TOURNAMENT_ID) {
      params.set("id", clean);
    } else {
      params.delete("id");
    }
    setSearchParams(params);
  };

  return { id, setId, doc, loading, error };
}

/** Firebase Auth state for the new format's own registration flow. */
export function useGsdeAuth() {
  const [user, setUser] = useState<User | null>(() => currentAuthUser());
  const [loading, setLoading] = useState(true);
  useEffect(
    () =>
      subscribeAuthUser((next) => {
        setUser(next);
        setLoading(false);
      }),
    []
  );
  return { user, loading };
}

export const teamNameMap = (teams: readonly Team[]): Map<TeamId, string> =>
  new Map(teams.map((team) => [team.id, team.name]));

export const nameOf = (
  names: Map<TeamId, string>,
  teamId: TeamId | null | undefined
): string =>
  teamId ? names.get(teamId) ?? teamId : "TBD";

export const STATUS_LABEL: Record<GsdeTournamentStatus, string> = {
  draft: "Draft",
  configured: "Configured",
  "group-stage": "Group stage",
  elimination: "Double elimination",
  "grand-final": "Grand Final",
  completed: "Completed",
};

export const statusColor = (status: GsdeTournamentStatus): string => {
  switch (status) {
    case "completed":
      return "bg-emerald-100 text-emerald-800";
    case "grand-final":
      return "bg-amber-100 text-amber-800";
    case "elimination":
      return "bg-violet-100 text-violet-800";
    case "group-stage":
      return "bg-sky-100 text-sky-800";
    default:
      return "bg-slate-100 text-slate-700";
  }
};

export const linkLabel = (link: BracketLink | null): string =>
  link
    ? `${getGameLabel(link.matchId)} → ${link.slot === "teamA" ? "Team A" : "Team B"}`
    : "—";

interface PageShellProps {
  title: string;
  subtitle?: string;
  badge?: ReactNode;
  backTo: string;
  backLabel: string;
  children: ReactNode;
}

export function PageShell({
  title,
  subtitle,
  badge,
  backTo,
  backLabel,
  children,
}: PageShellProps) {
  const [searchParams] = useSearchParams();
  const currentId = searchParams.get("id")?.trim() || DEFAULT_GSDE_TOURNAMENT_ID;
  return (
    <div className="min-h-screen bg-gradient-to-br from-sand-light via-sand to-ocean-light/20 px-4 pt-8 pb-10 flex items-start justify-center">
      <div className="w-full max-w-6xl mx-auto animate-fade-in">
        <Link
          to={backTo}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-ocean hover:text-ocean-dark transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {backLabel}
        </Link>
        <div className="mt-4 flex flex-wrap items-start gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl md:text-3xl font-extrabold text-foreground">
                {title}
              </h1>
              {badge}
            </div>
            {subtitle ? (
              <p className="mt-1 text-sm text-foreground/70">{subtitle}</p>
            ) : null}
          </div>
        </div>
        <div className="mt-6 space-y-6">{children}</div>
        <div className="mt-10 text-center text-sm text-foreground/60">
          <Link
            to={gsdeHref(GROUP_DOUBLE_ELIMINATION_FORMAT.route, currentId)}
            className="font-semibold text-foreground/80 hover:underline"
          >
            Back to format overview
          </Link>
        </div>
      </div>
    </div>
  );
}
