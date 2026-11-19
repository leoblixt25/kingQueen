import { useEffect, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import type {
  BracketLink,
  GsdeTournamentStatus,
  PlayerRegistration,
  Team,
  TeamId,
} from "@/formats/group-double-elimination";
import { getGameLabel } from "@/formats/group-double-elimination";
import { resolveTeamDisplayName } from "@/formats/group-double-elimination/category";
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
import { ArrowLeft, Loader2 } from "lucide-react";
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

/** K&Q-style Google button shared by the player sign-in and register pages. */
export function GsdeGoogleButton({
  onClick,
  busy = false,
}: {
  onClick: () => void;
  busy?: boolean;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      onClick={onClick}
      disabled={busy}
      className="w-full touch-target font-semibold py-3 transition-all duration-300 bg-white/70 hover:bg-red-50 hover:text-red-700 border-red-200 text-red-600"
    >
      {busy ? (
        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
      ) : (
        <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" aria-hidden="true">
          <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
          <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
          <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
          <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
        </svg>
      )}
      {busy ? "Signing in…" : "Continue with Google"}
    </Button>
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

export const teamNameMap = (
  teams: readonly Team[],
  registrations: readonly PlayerRegistration[] = []
): Map<TeamId, string> => {
  return new Map(
    teams.map((team) => [team.id, resolveTeamDisplayName(registrations, team)])
  );
};

export const nameOf = (
  names: Map<TeamId, string>,
  teamId: TeamId | null | undefined
): string =>
  teamId ? names.get(teamId) ?? teamId : "TBD";

export const STATUS_LABEL: Record<GsdeTournamentStatus, string> = {
  draft: "Draft",
  configured: "Configured",
  "group-stage": "Group stage",
  elimination: "In progress",
  "grand-final": "In progress",
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
