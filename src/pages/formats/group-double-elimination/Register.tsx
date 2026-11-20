import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  AlertCircle,
  CheckCircle2,
  Crown,
  Info,
  Loader2,
  LogOut,
  Users,
} from "lucide-react";
import { GROUP_DOUBLE_ELIMINATION_FORMAT } from "@/formats";
import type { PlayerGender } from "@/formats/group-double-elimination";
import { resolveTeamDisplayName } from "@/formats/group-double-elimination/category";
import {
  findRegistrationByEmail,
  findRegistrationByUid,
  normalizeRegistrationEmail,
  validateRegistrationDraft,
} from "@/formats/group-double-elimination/registration";
import {
  signOutRegistration,
  signUpForRegistration,
  signInWithGoogleForRegistration,
} from "@/formats/group-double-elimination/registrationAuth";
import { registerPlayer } from "@/formats/group-double-elimination/scoring";
import { getRegisteredTeamId } from "@/formats/group-double-elimination/registration";
import { saveGsdeTournament } from "@/formats/group-double-elimination/persistence";
import {
  GsdeGoogleButton,
  GsdeMainTitle,
  gsdeHref,
  useGsdeAuth,
  useGsdePlayerRedirect,
  useGsdeTournament,
} from "./shared";

const ROUTE = GROUP_DOUBLE_ELIMINATION_FORMAT.route;
const PENDING_ROUTE = `${ROUTE}/register/pending`;
const PLAYER_ROUTE = `${ROUTE}/player`;
const PAIRING_ROUTE = `${ROUTE}/pairing`;
const SIGN_IN_ROUTE = `${ROUTE}/sign-in`;
const PLAYER_ACCESS_ROUTE = `${ROUTE}/player-access`;

const inputCls =
  "w-full touch-target bg-white/70 border-sand-dark/30 focus:border-ocean";

const firebaseMessage = (error: unknown): string => {
  const code = (error as { code?: string })?.code ?? "";
  if (code.includes("email-already-in-use")) {
    return "That email already has an account. Use “Sign in” instead.";
  }
  if (code.includes("weak-password")) return "Choose a password of at least 6 characters.";
  if (code.includes("invalid-email")) return "Enter a valid email address.";
  if (code.includes("popup-closed-by-user")) return "Google sign-in was cancelled.";
  return error instanceof Error ? error.message : "Could not complete sign-up.";
};

/** K&Q-style player registration, scoped to the isolated GSDE flow. */
export default function GroupDoubleEliminationRegister() {
  const { id, doc, loading: docLoading } = useGsdeTournament();
  const { user, loading: authLoading } = useGsdeAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [name, setName] = useState("");
  const [gender, setGender] = useState<PlayerGender | "">("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A signed-in player who is already registered belongs on their state page.
  useGsdePlayerRedirect({
    current: "register",
    doc,
    id,
    uid: user?.uid,
    ready: !docLoading && !authLoading,
    enabled: searchParams.get("mode") !== "sign-in",
  });

  // The old combined "?mode=sign-in" link now opens the dedicated sign-in page.
  useEffect(() => {
    if (searchParams.get("mode") === "sign-in") {
      navigate(gsdeHref(SIGN_IN_ROUTE, id), { replace: true });
    }
  }, [searchParams, id, navigate]);

  // Pre-fill from the signed-in account when available.
  useEffect(() => {
    if (!user) return;
    setEmail(user.email ?? "");
    setName((current) => current || user.displayName || "");
  }, [user]);

  const existing = useMemo(() => {
    if (!doc) return undefined;
    return (
      (user && findRegistrationByUid(doc, user.uid)) ||
      (email && findRegistrationByEmail(doc, email))
    );
  }, [doc, user, email]);

  const goTo = (route: string) => navigate(gsdeHref(route, id));

  const handleSignOut = async () => {
    setBusy(true);
    try {
      await signOutRegistration();
    } finally {
      setBusy(false);
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!doc) return;

    const activeEmail = user?.email ?? email;
    const issues = validateRegistrationDraft({
      uid: user?.uid ?? "pending",
      email: activeEmail,
      name,
      gender: gender as PlayerGender,
    });
    if (issues.length > 0) {
      setError(issues.map((issue) => issue.message).join(" "));
      return;
    }

    setBusy(true);
    try {
      // Creating an account writes to Firebase Auth only — never to K&Q data.
      const account =
        user ?? (await signUpForRegistration(name, activeEmail, password));
      const registrationEmail = normalizeRegistrationEmail(
        account.email ?? activeEmail
      );
      const next = registerPlayer(
        doc,
        {
          uid: account.uid,
          email: registrationEmail,
          name,
          gender: gender as PlayerGender,
        },
        { id: account.uid, label: registrationEmail, isAdmin: false }
      );
      await saveGsdeTournament(next);
      goTo(PENDING_ROUTE);
    } catch (err) {
      setError(firebaseMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setError(null);
    if (!doc) return;
    if (gender !== "male" && gender !== "female") {
      setError("Select your player gender before continuing with Google.");
      return;
    }
    setBusy(true);
    try {
      const account = user ?? (await signInWithGoogleForRegistration());
      const displayName = name.trim() || account.displayName || "";
      if (displayName.trim().length < 2) {
        setError("Enter your name above before continuing with Google.");
        return;
      }
      const registrationEmail = normalizeRegistrationEmail(
        account.email ?? email
      );
      const next = registerPlayer(
        doc,
        {
          uid: account.uid,
          email: registrationEmail,
          name: displayName,
          gender,
        },
        { id: account.uid, label: registrationEmail, isAdmin: false }
      );
      await saveGsdeTournament(next);
      goTo(PENDING_ROUTE);
    } catch (err) {
      setError(firebaseMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const handleCancel = () => {
    setName("");
    setGender("");
    setEmail(user?.email ?? "");
    setPassword("");
    setError(null);
  };

  return (
    <div className="min-h-screen bg-sand-gradient px-4 py-6">
      <div className="max-w-lg mx-auto space-y-6 animate-fade-in">
        <header className="text-center pt-8">
          <div className="relative">
            <div className="w-full max-w-2xl mx-auto text-center px-4 mb-4">
              <GsdeMainTitle />
            </div>
            <div className="w-16 h-1 bg-sunset mx-auto rounded-full mb-6" />
            <h2 className="text-xl font-semibold text-ocean mb-2">
              Tournament Access Portal
            </h2>

            <div className="mt-4 flex justify-center gap-2">
              {user ? (
                <div className="flex items-center gap-2 text-sm">
                  <div className="flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-full">
                    <CheckCircle2 className="w-4 h-4" />
                    {user.email}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSignOut}
                    disabled={busy}
                    className="text-xs"
                  >
                    <LogOut className="w-3 h-3 mr-1" />
                    Sign Out
                  </Button>
                </div>
              ) : (
                <div className="text-center text-sm text-foreground/60 mt-2">
                  Already have an account?{" "}
                  <Button
                    variant="link"
                    onClick={() => goTo(SIGN_IN_ROUTE)}
                    className="p-0 h-auto text-ocean hover:text-ocean-dark font-medium"
                  >
                    Sign in here
                  </Button>
                </div>
              )}
            </div>
          </div>
        </header>

        <Card className="bg-white/80 backdrop-blur-sm border border-sand-dark/20 shadow-beach">
          <CardContent className="p-4 text-center">
            <h3 className="font-semibold text-ocean mb-2">Current Tournament</h3>
            <div className="flex flex-wrap justify-center gap-2">
              <span className="px-3 py-1 bg-sunset/20 text-sunset rounded-full text-sm">
                {GROUP_DOUBLE_ELIMINATION_FORMAT.name}
              </span>
              <span className="px-3 py-1 bg-ocean/20 text-ocean rounded-full text-sm">
                {doc?.tournament.config.category ?? "Mixto"} · 2×2 teams
              </span>
            </div>
          </CardContent>
        </Card>

        {authLoading ? (
          <Card className="bg-white/80 backdrop-blur-sm border border-sand-dark/20 shadow-beach">
            <CardContent className="flex items-center justify-center gap-2 p-10 text-sm text-foreground/60">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading account…
            </CardContent>
          </Card>
        ) : existing ? (
          <Card className="bg-white/80 backdrop-blur-sm border border-sand-dark/20 shadow-beach">
            <CardHeader>
              <CardTitle className="text-center text-ocean font-bold flex items-center justify-center gap-2">
                <Crown className="w-5 h-5" />
                Your Registration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-center">
                <strong>{existing.name}</strong> · {existing.email}
              </p>
              <p className="text-center flex flex-wrap items-center justify-center gap-2">
                Status: <Badge variant="secondary">{existing.status}</Badge>
                {existing.status === "approved" && getRegisteredTeamId(doc, user?.uid ?? "") ? (
                  <span>
                    · Team:{" "}
                    {(() => {
                      const teamId = doc ? getRegisteredTeamId(doc, existing.uid) : null;
                      const team = doc?.teams.find((item) => item.id === teamId);
                      return team && doc
                        ? resolveTeamDisplayName(doc.registrations ?? [], team)
                        : teamId ?? "unknown";
                    })()}
                  </span>
                ) : null}
              </p>
              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={() => goTo(PENDING_ROUTE)}
                  className="flex-1 touch-target bg-white/70"
                >
                  View status
                </Button>
                {existing.status === "approved" ? (
                  <Button
                    variant="outline"
                    onClick={() => goTo(PAIRING_ROUTE)}
                    className="flex-1 touch-target bg-white/70"
                  >
                    Find a partner
                  </Button>
                ) : null}
              </div>
              {existing.status === "approved" ? (
                <Button
                  onClick={() => goTo(PLAYER_ROUTE)}
                  className="w-full touch-target bg-ocean hover:bg-ocean-dark text-white font-semibold"
                >
                  <Users className="w-4 h-4 mr-2" />
                  My team
                </Button>
              ) : null}
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-white/80 backdrop-blur-sm border border-sand-dark/20 shadow-beach">
            <CardHeader>
              <CardTitle className="text-center text-ocean font-bold flex items-center justify-center gap-2">
                <Crown className="w-5 h-5" />
                Player Registration
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={submit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="gsde-register-name" className="text-foreground font-medium">
                    Name
                  </Label>
                  <Input
                    id="gsde-register-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className={inputCls}
                    placeholder="Enter your name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="gsde-register-email" className="text-foreground font-medium">
                    Email Address
                  </Label>
                  <Input
                    id="gsde-register-email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    disabled={Boolean(user?.email)}
                    className={inputCls}
                    placeholder="Enter your email"
                  />
                  {user?.email ? (
                    <p className="text-xs text-muted-foreground italic">
                      Email locked to your authenticated account ({user.email})
                    </p>
                  ) : null}
                </div>

                {!user ? (
                  <div className="space-y-2">
                    <Label htmlFor="gsde-register-password" className="text-foreground font-medium">
                      Password
                    </Label>
                    <Input
                      id="gsde-register-password"
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      minLength={6}
                      className={inputCls}
                      placeholder="Create a password (min 6 characters)"
                    />
                    <p className="text-xs text-muted-foreground">
                      Must be at least 6 characters
                    </p>
                  </div>
                ) : null}

                <div className="space-y-3">
                  <Label className="text-foreground font-medium">Gender Division</Label>
                  <RadioGroup
                    value={gender}
                    onValueChange={(value) => setGender(value as PlayerGender)}
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="male" id="gsde-male" />
                      <Label htmlFor="gsde-male" className="cursor-pointer">
                        Male
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="female" id="gsde-female" />
                      <Label htmlFor="gsde-female" className="cursor-pointer">
                        Female
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                {error ? (
                  <Alert className="border-coral/30 bg-coral/10">
                    <AlertCircle className="h-4 w-4 text-coral" />
                    <AlertDescription className="text-coral-dark">
                      {error}
                    </AlertDescription>
                  </Alert>
                ) : null}

                <div className="flex gap-3 pt-4">
                  <Button
                    type="submit"
                    disabled={busy}
                    className="flex-1 touch-target bg-ocean hover:bg-ocean-dark text-white font-semibold py-3 transition-all duration-300"
                  >
                    {busy ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Registering...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Register
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCancel}
                    disabled={busy}
                    className="flex-1 touch-target bg-white/70 hover:bg-coral hover:text-white border-coral/30 text-coral transition-all duration-300"
                  >
                    Cancel
                  </Button>
                </div>
              </form>

              <Alert className="mt-6 border-ocean/30 bg-ocean/5">
                <Info className="h-4 w-4 text-ocean" />
                <AlertDescription className="text-foreground/70">
                  Register as an individual player first. An admin approves your
                  registration, then you can invite another approved player to
                  create your 2×2 team automatically. Your data is stored only
                  in this tournament.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        )}

        <Card className="bg-white/80 backdrop-blur-sm border border-ocean/20 shadow-beach">
          <CardContent className="p-6">
            <div className="text-center space-y-4">
              <h3 className="text-lg font-semibold text-ocean">Continue with Google</h3>
              <p className="text-sm text-foreground/70">
                Sign up with Google for secure account access and automatic email
                confirmation.
              </p>
              <GsdeGoogleButton onClick={google} busy={busy} />
            </div>
          </CardContent>
        </Card>

        <div className="text-center">
          <Button
            variant="ghost"
            onClick={() => goTo(PLAYER_ACCESS_ROUTE)}
            className="text-ocean hover:text-ocean-dark"
          >
            ← Back to Player Access
          </Button>
        </div>
      </div>
    </div>
  );
}
