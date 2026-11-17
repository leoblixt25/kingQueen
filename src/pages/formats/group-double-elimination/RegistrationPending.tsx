import { useNavigate } from "react-router-dom";
import { AlertCircle, CheckCircle2, Clock3, Loader2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GROUP_DOUBLE_ELIMINATION_FORMAT } from "@/formats";
import { findRegistrationByUid } from "@/formats/group-double-elimination/registration";
import { PageShell, useGsdeAuth, useGsdeTournament } from "./shared";

const REGISTER_ROUTE = `${GROUP_DOUBLE_ELIMINATION_FORMAT.route}/register`;
const PLAYER_ROUTE = `${GROUP_DOUBLE_ELIMINATION_FORMAT.route}/player`;

export default function GroupDoubleEliminationRegistrationPending() {
  const { id, doc } = useGsdeTournament();
  const { user, loading: authLoading } = useGsdeAuth();
  const navigate = useNavigate();
  const registration = doc && user ? findRegistrationByUid(doc, user.uid) : undefined;

  const goTo = (route: string) =>
    navigate(`${route}?id=${encodeURIComponent(id)}`);

  return (
    <PageShell
      title="Registration status"
      subtitle={`${GROUP_DOUBLE_ELIMINATION_FORMAT.name} · approval status`}
      backTo={`${GROUP_DOUBLE_ELIMINATION_FORMAT.route}?id=${encodeURIComponent(id)}`}
      backLabel="Tournament overview"
    >
      {authLoading ? (
        <Card className="border-sand-dark/40 shadow-beach bg-card/95">
          <CardContent className="flex items-center justify-center gap-2 p-10 text-sm text-foreground/60">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading account…
          </CardContent>
        </Card>
      ) : !user ? (
        <Card className="border-red-300 bg-red-50">
          <CardContent className="space-y-3 p-5 text-sm text-red-800">
            <p className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4" /> Sign in to see your registration status.
            </p>
            <Button size="sm" onClick={() => goTo(REGISTER_ROUTE)}>
              Go to registration
            </Button>
          </CardContent>
        </Card>
      ) : !registration ? (
        <Card className="border-sand-dark/40 shadow-beach bg-card/95">
          <CardContent className="space-y-3 p-5 text-sm text-foreground/75">
            <p>No registration found for this account in this tournament.</p>
            <Button size="sm" onClick={() => goTo(REGISTER_ROUTE)}>
              Register as a player
            </Button>
          </CardContent>
        </Card>
      ) : registration.status === "approved" ? (
        <Card className="border-emerald-300/60 bg-emerald-50/70 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-emerald-900">
              <CheckCircle2 className="h-4 w-4" /> You're approved
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-emerald-900">
            <p>
              <strong>{registration.name}</strong> is registered and assigned to{" "}
              <strong>
                {doc?.teams.find((team) => team.id === registration.teamId)?.name ??
                  registration.teamId}
              </strong>
              .
            </p>
            <Button size="sm" onClick={() => goTo(PLAYER_ROUTE)}>
              Open My team
            </Button>
          </CardContent>
        </Card>
      ) : registration.status === "rejected" ? (
        <Card className="border-red-300 bg-red-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-red-800">
              <XCircle className="h-4 w-4" /> Registration not approved
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-red-800">
            <p>Contact the organiser if you think this is a mistake.</p>
            <Button size="sm" variant="outline" onClick={() => goTo(REGISTER_ROUTE)}>
              Back to registration
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-amber-300/60 bg-amber-50/70 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-amber-900">
              <Clock3 className="h-4 w-4" /> Waiting for approval
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-amber-900">
            <p>
              <strong>{registration.name}</strong> is registered as <Badge variant="secondary">{registration.email}</Badge>.
              An admin will approve your registration and assign you to a team.
            </p>
            <p className="text-xs text-amber-800/75">
              This page updates automatically — no refresh needed.
            </p>
          </CardContent>
        </Card>
      )}
    </PageShell>
  );
}
