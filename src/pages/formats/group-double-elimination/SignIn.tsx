import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ChevronLeft,
  Eye,
  EyeOff,
  Info,
  Loader2,
  Lock,
  Mail,
} from "lucide-react";
import { GROUP_DOUBLE_ELIMINATION_FORMAT } from "@/formats";
import { destinationForRegistration } from "@/formats/group-double-elimination/playerRouting";
import {
  findRegistrationByEmail,
  findRegistrationByUid,
} from "@/formats/group-double-elimination/registration";
import {
  signInForRegistration,
  signInWithGoogleForRegistration,
  type User,
} from "@/formats/group-double-elimination/registrationAuth";
import {
  GsdeGoogleButton,
  GsdeMainTitle,
  gsdeHref,
  gsdePlayerRoute,
  useGsdeTournament,
} from "./shared";

const ROUTE = GROUP_DOUBLE_ELIMINATION_FORMAT.route;

const firebaseMessage = (error: unknown): string => {
  const code = (error as { code?: string })?.code ?? "";
  if (code.includes("wrong-password") || code.includes("invalid-credential")) {
    return "Wrong email or password.";
  }
  if (code.includes("user-not-found")) return "No account for that email. Register first.";
  if (code.includes("invalid-email")) return "Enter a valid email address.";
  if (code.includes("popup-closed-by-user")) return "Google sign-in was cancelled.";
  return error instanceof Error ? error.message : "Could not sign in.";
};

/** K&Q-style player sign-in screen, scoped to the isolated GSDE flow. */
export default function GroupDoubleEliminationSignIn() {
  const navigate = useNavigate();
  const { id, doc, loading: tournamentLoading } = useGsdeTournament();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const go = (route: string) => navigate(gsdeHref(route, id));

  const redirectAfterSignIn = (user: User) => {
    const registration =
      (doc && findRegistrationByUid(doc, user.uid)) ||
      (doc && user.email && findRegistrationByEmail(doc, user.email));
    const destination =
      doc && registration
        ? destinationForRegistration(doc, registration)
        : "register";
    navigate(gsdePlayerRoute(destination, id), { replace: true });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError("Enter both your email and password.");
      return;
    }
    setBusy(true);
    try {
      const user = await signInForRegistration(email, password);
      redirectAfterSignIn(user);
    } catch (err) {
      setError(firebaseMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const handleGoogle = async () => {
    setError(null);
    setBusy(true);
    try {
      const user = await signInWithGoogleForRegistration();
      redirectAfterSignIn(user);
    } catch (err) {
      setError(firebaseMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-sand-gradient px-4 py-6 flex items-start justify-center">
      <Button
        variant="ghost"
        onClick={() => go(`${ROUTE}/player-access`)}
        className="absolute left-4 top-4 text-foreground/70 hover:text-foreground"
      >
        <ChevronLeft className="w-4 h-4 mr-1" />
        Back
      </Button>

      <div className="w-full max-w-md mx-auto">
        <div className="text-center mb-6 pt-12">
          <div className="text-6xl mb-4 animate-bounce-gentle">🏐</div>
          <div className="w-full max-w-2xl mx-auto text-center px-4 mb-2">
            <GsdeMainTitle />
          </div>
        </div>

        <Card className="bg-white/80 backdrop-blur-sm border border-sand-dark/20 shadow-beach">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-2xl font-bold text-ocean">
              Sign In to Your Account
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4 mb-6">
              <div className="space-y-2">
                <Label htmlFor="gsde-signin-email" className="text-foreground font-medium">
                  Email Address
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-foreground/50 w-4 h-4" />
                  <Input
                    id="gsde-signin-email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="w-full touch-target bg-white/70 border-sand-dark/30 focus:border-ocean pl-10"
                    placeholder="Enter your email"
                    disabled={busy}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="gsde-signin-password" className="text-foreground font-medium">
                  Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-foreground/50 w-4 h-4" />
                  <Input
                    id="gsde-signin-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="w-full touch-target bg-white/70 border-sand-dark/30 focus:border-ocean pl-10 pr-10"
                    placeholder="Enter your password"
                    disabled={busy}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowPassword((current) => !current)}
                    className="absolute right-0 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0 hover:bg-transparent"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-foreground/50" />
                    ) : (
                      <Eye className="h-4 w-4 text-foreground/50" />
                    )}
                  </Button>
                </div>
              </div>

              {error ? (
                <Alert className="border-destructive/40 bg-destructive/5">
                  <Info className="h-4 w-4 text-destructive" />
                  <AlertDescription className="text-destructive">
                    {error}
                  </AlertDescription>
                </Alert>
              ) : null}

              <Button
                type="submit"
                disabled={busy || tournamentLoading}
                className="w-full touch-target bg-ocean hover:bg-ocean-dark text-white font-semibold py-3 transition-all duration-300"
              >
                {busy ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Signing In...
                  </>
                ) : (
                  "Sign In"
                )}
              </Button>
            </form>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-foreground/60">Or continue with</span>
              </div>
            </div>

            <GsdeGoogleButton onClick={handleGoogle} busy={busy} />

            <Alert className="mt-6 border-sunset/30 bg-sunset/10">
              <Info className="h-4 w-4 text-sunset" />
              <AlertDescription className="text-sunset-dark">
                <p className="font-medium mb-1">Don&apos;t have an account?</p>
                <p className="text-sm">
                  Go back and select &ldquo;Register&rdquo; to create a new account.
                </p>
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        <div className="mt-6 text-center text-sm text-foreground/60">
          <p>🌊 Beach Volleyball Tournament Tracker 🏖️</p>
        </div>
      </div>
    </div>
  );
}
