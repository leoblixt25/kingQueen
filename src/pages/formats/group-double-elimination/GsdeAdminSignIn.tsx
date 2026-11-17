import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertCircle,
  ArrowLeft,
  Eye,
  EyeOff,
  Loader2,
  LogIn,
  ShieldCheck,
} from "lucide-react";
import { GROUP_DOUBLE_ELIMINATION_FORMAT } from "@/formats";
import { adminSignInWithEmail, isAdmin, signInWithGoogle } from "@/utils/authUtils";
import { auth } from "@/config/firebase";
import { signOut } from "firebase/auth";
import {
  DEFAULT_GSDE_TOURNAMENT_ID,
  GsdeMainTitle,
  gsdeHref,
} from "./shared";

const ROUTE = GROUP_DOUBLE_ELIMINATION_FORMAT.route;

/** K&Q-style admin sign-in screen, scoped to the isolated GSDE flow. */
export default function GsdeAdminSignIn() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const id = searchParams.get("id")?.trim() || DEFAULT_GSDE_TOURNAMENT_ID;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const goBack = () => navigate(gsdeHref(ROUTE, id));

  const finishAdminSignIn = () => {
    navigate(gsdeHref(`${ROUTE}/admin`, id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const result = await adminSignInWithEmail(email, password);
      if (!result.success) {
        throw new Error(result.error || "Invalid admin credentials.");
      }
      const ok = await isAdmin();
      if (!ok) {
        await signOut(auth);
        throw new Error("Access denied. This account does not have admin privileges.");
      }
      finishAdminSignIn();
    } catch (err: any) {
      setError(err?.message || "Unable to sign in. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await signInWithGoogle();
      if (!result.success) {
        throw new Error(result.error || "Google sign-in failed.");
      }
      const ok = await isAdmin();
      if (!ok) {
        await signOut(auth);
        throw new Error("Access denied. This account does not have admin privileges.");
      }
      finishAdminSignIn();
    } catch (err: any) {
      setError(err?.message || "Google sign-in failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-sand-gradient px-4 py-6 flex items-start justify-center">
      <Button
        variant="ghost"
        size="sm"
        onClick={goBack}
        className="absolute left-4 top-4 inline-flex items-center gap-1.5 text-sm font-semibold text-ocean hover:text-ocean-dark hover:bg-transparent"
      >
        <ArrowLeft className="w-4 h-4" />
        Tournament
      </Button>

      <div className="w-full max-w-md mx-auto text-center pt-14 animate-fade-in">
        <div className="text-6xl mb-4 animate-bounce-gentle">🏐</div>
        <div className="w-full max-w-2xl mx-auto text-center px-4 mb-6">
          <GsdeMainTitle />
        </div>

        <Card className="bg-white/85 backdrop-blur-sm border border-sand-dark/20 shadow-beach">
          <CardContent className="pt-6 pb-6">
            <div className="mb-5 flex items-center justify-center gap-2 text-foreground/85">
              <ShieldCheck className="w-5 h-5 text-ocean" />
              <h2 className="text-lg font-bold">Admin Sign In</h2>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-left">
              <div className="space-y-1.5">
                <Label htmlFor="gsde-admin-email">Email</Label>
                <Input
                  id="gsde-admin-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@example.com"
                  autoComplete="username"
                  disabled={loading}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="gsde-admin-password">Password</Label>
                <div className="relative">
                  <Input
                    id="gsde-admin-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    disabled={loading}
                    className="pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-foreground/50 hover:text-foreground"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {error ? (
                <Alert className="border-destructive/40 bg-destructive/5">
                  <AlertCircle className="h-4 w-4 text-destructive" />
                  <AlertDescription className="text-destructive text-left">
                    {error}
                  </AlertDescription>
                </Alert>
              ) : null}

              <Button
                type="submit"
                disabled={loading}
                className="w-full py-6 text-lg font-semibold bg-ocean hover:bg-ocean-dark text-white shadow-beach transition-all duration-300 flex items-center justify-center gap-3"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <LogIn className="w-5 h-5" />
                )}
                {loading ? "Signing in…" : "Sign in as Admin"}
              </Button>
            </form>

            <div className="relative my-5">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-gray-500">Or</span>
              </div>
            </div>

            <Button
              onClick={handleGoogleSignIn}
              disabled={loading}
              variant="outline"
              className="w-full py-6 text-lg font-semibold border-ocean/60 bg-ocean/5 text-ocean hover:bg-ocean hover:text-white shadow-sm transition-all duration-300 flex items-center justify-center gap-3"
            >
              <ShieldCheck className="w-5 h-5" />
              Sign in with Google
            </Button>
          </CardContent>
        </Card>

        <div className="mt-8 text-sm text-foreground/60">
          <p>🌊 Beach Volleyball Tournament Tracker 🏖️</p>
          <p className="mt-2 text-xs">
            Admin access is restricted to authorized accounts.
          </p>
        </div>
      </div>
    </div>
  );
}
