import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  ArrowLeft,
  Info,
  LogIn,
  LogOut,
  UserPlus,
  Users,
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

const ROUTE = GROUP_DOUBLE_ELIMINATION_FORMAT.route;

/** K&Q-style player access screen, scoped to the isolated GSDE flow. */
export default function GroupDoubleEliminationPlayerAccess() {
  const navigate = useNavigate();
  const { id, doc } = useGsdeTournament();
  const { user, loading } = useGsdeAuth();
  const [signingOut, setSigningOut] = useState(false);

  const registration = doc && user ? findRegistrationByUid(doc, user.uid) : undefined;

  const go = (route: string) => navigate(gsdeHref(route, id));
  const goToRegister = (mode: "sign-in" | "register") => {
    const base = gsdeHref(`${ROUTE}/register`, id);
    navigate(`${base}${base.includes("?") ? "&" : "?"}mode=${mode}`);
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOutRegistration();
    } finally {
      setSigningOut(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-sand-gradient px-4 py-6 flex items-center justify-center">
        <div className="text-center animate-fade-in">
          <div className="text-6xl mb-4 animate-bounce-gentle">🏐</div>
          <h2 className="text-2xl font-bold mb-3 bg-ocean-gradient bg-clip-text text-transparent">
            Loading…
          </h2>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-sand-gradient px-4 py-6 flex items-start justify-center">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => go(ROUTE)}
        className="absolute left-4 top-4 inline-flex items-center gap-1.5 text-sm font-semibold text-ocean hover:text-ocean-dark hover:bg-transparent"
      >
        <ArrowLeft className="w-4 h-4" />
        Tournament
      </Button>

      <div className="w-full max-w-md mx-auto text-center pt-14">
        <div className="text-6xl mb-6 animate-bounce-gentle">🏐</div>
        <div className="w-full max-w-2xl mx-auto text-center px-4 mb-8">
          <GsdeMainTitle />
        </div>

        <div className="space-y-6">
          <Card className="bg-white/80 backdrop-blur-sm border border-sand-dark/20 shadow-beach">
            <CardContent className="space-y-4 pt-6">
              <Button
                onClick={() => goToRegister("sign-in")}
                className="w-full py-6 text-lg font-semibold bg-ocean hover:bg-ocean-dark text-white shadow-beach transition-all duration-300 flex items-center justify-center gap-3"
              >
                <LogIn className="w-5 h-5" />
                Sign In
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-gray-500">Or</span>
                </div>
              </div>

              <Button
                onClick={() => goToRegister("register")}
                className="w-full py-6 text-lg font-semibold bg-sunset hover:bg-sunset-dark text-white shadow-beach transition-all duration-300 flex items-center justify-center gap-3"
              >
                <UserPlus className="w-5 h-5" />
                Register
              </Button>

              <Button
                onClick={() => go(`${ROUTE}/player`)}
                variant="outline"
                className="w-full py-6 text-lg font-semibold border-ocean/60 bg-ocean/5 text-ocean hover:bg-ocean hover:text-white shadow-sm transition-all duration-300 flex items-center justify-center gap-3"
              >
                <Users className="w-5 h-5" />
                My team
              </Button>
            </CardContent>
          </Card>

          {user ? (
            <Alert className="border-blue-300 bg-blue-100">
              <Info className="h-4 w-4 text-blue-700" />
              <AlertDescription className="text-blue-700 text-left">
                <p className="font-medium">Signed in</p>
                <p className="text-sm mt-1 break-all">{user.email}</p>
                {registration ? (
                  <p className="text-sm mt-1">
                    Registration: <strong>{registration.status}</strong>
                    {registration.status === "approved" && registration.teamId ? (
                      <>
                        {" · "}
                        {(() => {
                          const team = doc?.teams.find(
                            (item) => item.id === registration.teamId
                          );
                          return team && doc
                            ? resolveTeamDisplayName(doc.registrations ?? [], team)
                            : registration.teamId;
                        })()}
                      </>
                    ) : null}
                  </p>
                ) : (
                  <p className="text-sm mt-1">
                    No registration yet for this tournament.
                  </p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    onClick={() => go(`${ROUTE}/register/pending`)}
                    variant="outline"
                    className="flex-1 border-blue-300 bg-white text-blue-700 hover:bg-blue-50"
                  >
                    View status
                  </Button>
                  {registration?.status === "approved" ? (
                    <Button
                      onClick={() => go(`${ROUTE}/player`)}
                      className="flex-1 bg-ocean text-white hover:bg-ocean-dark"
                    >
                      My team
                    </Button>
                  ) : null}
                </div>
                <Button
                  onClick={handleSignOut}
                  disabled={signingOut}
                  variant="outline"
                  className="mt-2 w-full border-blue-300 bg-white text-blue-700 hover:bg-blue-50"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign Out
                </Button>
              </AlertDescription>
            </Alert>
          ) : null}
        </div>

        <div className="mt-8 text-sm text-foreground/60">
          <p>🌊 Beach Volleyball Tournament Tracker 🏖️</p>
          <p className="mt-2 text-xs">
            Sign in if you already have an account, or register for a new one.
          </p>
        </div>
      </div>
    </div>
  );
}
