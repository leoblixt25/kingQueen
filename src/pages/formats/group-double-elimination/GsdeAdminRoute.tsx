import { useEffect, useState, type ReactNode } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { GROUP_DOUBLE_ELIMINATION_FORMAT } from "@/formats";
import { isAdmin } from "@/utils/authUtils";
import {
  DEFAULT_GSDE_TOURNAMENT_ID,
  gsdeHref,
  useGsdeAuth,
} from "./shared";

const ROUTE = GROUP_DOUBLE_ELIMINATION_FORMAT.route;

/**
 * Admin guard for the isolated GSDE flow.
 *
 * K&Q's `ProtectedRoute` sends any unauthenticated / non-admin visitor back to
 * `/`, which made the hub's Admin button look broken. This guard keeps the
 * visitor in the GSDE flow: they are sent to the GSDE admin sign-in page with
 * the selected tournament id preserved. K&Q routes are not affected.
 */
export default function GsdeAdminRoute({ children }: { children: ReactNode }) {
  const [searchParams] = useSearchParams();
  const id = searchParams.get("id")?.trim() || DEFAULT_GSDE_TOURNAMENT_ID;
  const { user, loading: authLoading } = useGsdeAuth();
  const [adminStatus, setAdminStatus] = useState<boolean | null>(null);

  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;
    if (!user) {
      setAdminStatus(false);
      return;
    }
    isAdmin()
      .then((ok) => {
        if (!cancelled) setAdminStatus(ok);
      })
      .catch(() => {
        if (!cancelled) setAdminStatus(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  if (authLoading || adminStatus === null) {
    return (
      <div className="min-h-screen bg-sand-gradient px-4 py-6 flex items-center justify-center">
        <div className="text-center animate-fade-in">
          <div className="text-6xl mb-4 animate-bounce-gentle">🏐</div>
          <h2 className="text-2xl font-bold mb-3 bg-ocean-gradient bg-clip-text text-transparent">
            Verifying admin access…
          </h2>
          <p className="text-foreground/70 font-medium">🌊 One moment 🏖️</p>
        </div>
      </div>
    );
  }

  if (!user || !adminStatus) {
    return <Navigate to={gsdeHref(`${ROUTE}/admin/sign-in`, id)} replace />;
  }

  return <>{children}</>;
}
