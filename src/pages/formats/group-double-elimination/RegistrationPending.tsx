import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertCircle,
  ArrowLeft,
  Clock,
  Loader2,
  LogOut,
  Mail,
  Users,
  XCircle,
} from "lucide-react";
import { GROUP_DOUBLE_ELIMINATION_FORMAT } from "@/formats";
import { findRegistrationByUid } from "@/formats/group-double-elimination/registration";
import { signOutRegistration } from "@/formats/group-double-elimination/registrationAuth";
import { resolveTeamDisplayName } from "@/formats/group-double-elimination/category";
import {
  GsdeMainTitle,
  gsdeHref,
  useGsdeAuth,
  useGsdeTournament,
} from "./shared";
import GsdeBottomNav from "./GsdeBottomNav";

const ROUTE = GROUP_DOUBLE_ELIMINATION_FORMAT.route;
const REGISTER_ROUTE = `${ROUTE}/register`;
const SIGN_IN_ROUTE = `${ROUTE}/sign-in`;
const PLAYER_ACCESS_ROUTE = `${ROUTE}/player-access`;
const PLAYER_ROUTE = `${ROUTE}/player`;
const PAIRING_ROUTE = `${ROUTE}/pairing`;

const CARD = "w-full bg-white/90 backdrop-blur-sm border shadow-beach";
const PRIMARY =
  "w-full touch-target bg-ocean hover:bg-ocean-dark text-white font-semibold";

/** K&Q-style registration status screen, scoped to the isolated GSDE flow. */
export default function GroupDoubleEliminationRegistrationPending() {
  const navigate = useNavigate();
  const { id, doc, loading: docLoading } = useGsdeTournament();
  const { user, loading: authLoading } = useGsdeAuth();
  const [signingOut, setSigningOut] = useState(false);

  const registration = doc && user ? findRegistrationByUid(doc, user.uid) : undefined;
  const team = registration?.teamId && doc
    ? doc.teams.find((item) => item.id === registration.teamId)
    : undefined;
  const teamLabel = team && doc
    ? resolveTeamDisplayName(doc.registrations ?? [], team)
    : registration?.teamId ?? "not assigned yet";

  const go = (route: string) => navigate(gsdeHref(route, id));

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOutRegistration();
      go(PLAYER_ACCESS_ROUTE);
    } finally {
      setSigningOut(false);
    }
  };

  const homeButton = (
    <Button variant="outline" onClick={() => go(ROUTE)} className="w-full">
      <ArrowLeft className="w-4 h-4 mr-2" />
      Back to Home
    </Button>
  );

  return (
    <div className="min-h-screen bg-sand-gradient px-4 pt-6 pb-[calc(5.5rem+env(safe-area-inset-bottom))] flex items-start justify-center">
      <div className="w-full max-w-md mx-auto animate-fade-in">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => go(ROUTE)}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-ocean hover:text-ocean-dark hover:bg-transparent"
        >
          <ArrowLeft className="w-4 h-4" />
          Tournament
        </Button>

        <div className="text-center mt-6 mb-6">
          <div className="text-6xl mb-4 animate-bounce-gentle">🏐</div>
          <GsdeMainTitle />
        </div>

        {authLoading || docLoading ? (
          <Card className={`${CARD} border-ocean/20`}>
            <CardContent className="flex items-center justify-center gap-2 p-10 text-sm text-foreground/60">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading your status…
            </CardContent>
          </Card>
        ) : !user ? (
          <Card className={`${CARD} border-coral/20`}>
            <CardHeader>
              <CardTitle className="text-center text-coral">Sign In Required</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert className="border-coral/30 bg-coral/10">
                <AlertCircle className="h-4 w-4 text-coral" />
                <AlertDescription>
                  Sign in to see your registration status.
                </AlertDescription>
              </Alert>
              <Button onClick={() => go(SIGN_IN_ROUTE)} className={PRIMARY}>
                Sign In
              </Button>
              {homeButton}
            </CardContent>
          </Card>
        ) : !registration ? (
          <Card className={`${CARD} border-coral/20`}>
            <CardHeader>
              <CardTitle className="text-center text-coral">
                Registration Not Found
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert className="border-coral/30 bg-coral/10">
                <AlertDescription>
                  No registration found for this account in this tournament.
                </AlertDescription>
              </Alert>
              <Button onClick={() => go(REGISTER_ROUTE)} className={PRIMARY}>
                Go to Registration
              </Button>
              {homeButton}
            </CardContent>
          </Card>
        ) : registration.status === "approved" ? (
          <Card className={`${CARD} border-palm/20`}>
            <CardHeader>
              <CardTitle className="text-center text-palm flex items-center justify-center gap-2">
                🎉 Registration Approved!
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-center text-foreground/70">
                Welcome, <strong>{registration.name}</strong>! You can now access the tournament.
              </p>
              <Alert className="border-palm/30 bg-palm/10">
                <AlertDescription>
                  Team: <strong>{teamLabel}</strong>
                </AlertDescription>
              </Alert>
              <Button onClick={() => go(PLAYER_ROUTE)} className={PRIMARY}>
                <Users className="w-4 h-4 mr-2" />
                Open My team
              </Button>
              <Button
                variant="outline"
                onClick={() => go(PAIRING_ROUTE)}
                className="w-full"
              >
                Find a partner
              </Button>
              {homeButton}
            </CardContent>
          </Card>
        ) : registration.status === "rejected" ? (
          <Card className={`${CARD} border-coral/20`}>
            <CardHeader>
              <CardTitle className="text-center text-coral flex items-center justify-center gap-2">
                <XCircle className="w-5 h-5" />
                Registration Not Approved
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert className="border-coral/30 bg-coral/10">
                <AlertDescription>
                  Contact the organiser if you think this is a mistake.
                </AlertDescription>
              </Alert>
              <Button
                variant="outline"
                onClick={() => go(REGISTER_ROUTE)}
                className="w-full"
              >
                Back to registration
              </Button>
              {homeButton}
            </CardContent>
          </Card>
        ) : (
          <Card className={`${CARD} border-ocean/20`}>
            <CardHeader>
              <CardTitle className="text-center text-ocean flex items-center justify-center gap-2">
                <Clock className="w-6 h-6 animate-pulse" />
                Registration Pending Approval
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <Alert className="border-ocean/30 bg-ocean/10">
                <AlertDescription>
                  Thank you for registering, <strong>{registration.name}</strong>! Your
                  registration is currently pending admin approval.
                </AlertDescription>
              </Alert>

              <div className="flex items-center gap-2 text-sm">
                <Mail className="w-4 h-4 text-ocean" />
                <span className="text-foreground/70 break-all">{registration.email}</span>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <h3 className="font-semibold text-amber-800 mb-2">What happens next?</h3>
                <ul className="text-sm text-amber-700 space-y-2">
                  <li>• An admin will review your registration</li>
                  <li>• Invite a compatible registered player to form your team</li>
                  <li>• This page updates automatically once you&apos;re approved</li>
                </ul>
              </div>

              <div className="space-y-3">
                <Button onClick={() => go(PAIRING_ROUTE)} className={PRIMARY}>
                  <Users className="w-4 h-4 mr-2" />
                  Find a partner
                </Button>
                {homeButton}
                <Button
                  variant="outline"
                  onClick={handleSignOut}
                  disabled={signingOut}
                  className="w-full border-coral/30 text-coral hover:bg-coral/10"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign Out
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
      <GsdeBottomNav />
    </div>
  );
}
