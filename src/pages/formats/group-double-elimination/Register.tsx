import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AlertCircle, CheckCircle2, Loader2, UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { GROUP_DOUBLE_ELIMINATION_FORMAT } from "@/formats";
import type { PlayerGender } from "@/formats/group-double-elimination";
import { resolveTeamDisplayName } from "@/formats/group-double-elimination/category";
import {
  findRegistrationByEmail,
  findRegistrationByUid,
  normalizeRegistrationEmail,
  PLAYER_GENDER_OPTIONS,
  validateRegistrationDraft,
} from "@/formats/group-double-elimination/registration";
import {
  signInForRegistration,
  signInWithGoogleForRegistration,
  signUpForRegistration,
} from "@/formats/group-double-elimination/registrationAuth";
import { registerPlayer } from "@/formats/group-double-elimination/scoring";
import { saveGsdeTournament } from "@/formats/group-double-elimination/persistence";
import { PageShell, useGsdeAuth, useGsdeTournament } from "./shared";

const inputCls =
  "h-9 w-full rounded-md border border-sand-dark/40 bg-white px-2.5 text-sm text-foreground placeholder:text-foreground/40";

const PENDING_ROUTE = `${GROUP_DOUBLE_ELIMINATION_FORMAT.route}/register/pending`;
const PLAYER_ROUTE = `${GROUP_DOUBLE_ELIMINATION_FORMAT.route}/player`;

const firebaseMessage = (error: unknown): string => {
  const code = (error as { code?: string })?.code ?? "";
  if (code.includes("email-already-in-use")) {
    return "That email already has an account. Use “Sign in” instead.";
  }
  if (code.includes("weak-password")) return "Choose a password of at least 6 characters.";
  if (code.includes("invalid-email")) return "Enter a valid email address.";
  if (code.includes("wrong-password") || code.includes("invalid-credential")) {
    return "Wrong email or password.";
  }
  if (code.includes("user-not-found")) return "No account for that email. Register first.";
  if (code.includes("popup-closed-by-user")) return "Google sign-in was cancelled.";
  return error instanceof Error ? error.message : "Could not complete sign-up.";
};

export default function GroupDoubleEliminationRegister() {
  const { id, doc } = useGsdeTournament();
  const { user, loading: authLoading } = useGsdeAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialMode = searchParams.get("mode") === "sign-in" ? "sign-in" : "register";

  const [name, setName] = useState("");
  const [gender, setGender] = useState<PlayerGender | "">("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"register" | "sign-in">(initialMode);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const goTo = (route: string) =>
    navigate(`${route}?id=${encodeURIComponent(id)}`);

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
        user ??
        (mode === "register"
          ? await signUpForRegistration(name, activeEmail, password)
          : await signInForRegistration(activeEmail, password));
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

  return (
    <PageShell
      title="Player registration"
      subtitle={`${GROUP_DOUBLE_ELIMINATION_FORMAT.name} · ${doc?.tournament.config.category ?? "Mixto"} · register as an individual player`}
      backTo={`${GROUP_DOUBLE_ELIMINATION_FORMAT.route}?id=${encodeURIComponent(id)}`}
      backLabel="Tournament overview"
    >
      <Card className="border-ocean/20 bg-ocean/5 shadow-sm">
        <CardContent className="p-4 text-sm text-foreground/70">
          Register with your name, gender and account, then an admin will approve your
          registration and assign you to a fixed two-player team. Your registration is stored only
          in this tournament (
          <code className="rounded bg-white/70 px-1 py-0.5">
            tournaments/{`{id}`}
          </code>
          ); King &amp; Queen data is never touched.
        </CardContent>
      </Card>

      {authLoading ? (
        <Card className="border-sand-dark/40 shadow-beach bg-card/95">
          <CardContent className="flex items-center justify-center gap-2 p-10 text-sm text-foreground/60">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading account…
          </CardContent>
        </Card>
      ) : existing ? (
        <Card className="border-sand-dark/40 shadow-beach bg-card/95">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-ocean" /> Your registration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-foreground/75">
            <p>
              <strong>{existing.name}</strong> · {existing.email}
            </p>
            <p className="flex items-center gap-2">
              Status: <Badge variant="secondary">{existing.status}</Badge>
              {existing.status === "approved" && existing.teamId ? (
                <span>
                  · Team:{" "}
                  {(() => {
                    const team = doc?.teams.find((item) => item.id === existing.teamId);
                    return team && doc
                      ? resolveTeamDisplayName(doc.registrations ?? [], team)
                      : existing.teamId;
                  })()}
                </span>
              ) : null}
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button size="sm" variant="outline" onClick={() => goTo(PENDING_ROUTE)}>
                View status
              </Button>
              {existing.status === "approved" ? (
                <Button size="sm" onClick={() => goTo(PLAYER_ROUTE)}>
                  My team
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-sand-dark/40 shadow-beach bg-card/95">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-ocean" />
              {mode === "register" ? "Register as a player" : "Sign in to register"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-3" onSubmit={submit}>
              <label className="block text-xs text-foreground/60">
                Your name
                <Input
                  className={`${inputCls} mt-1`}
                  value={name}
                  placeholder="e.g. Alex Morgan"
                  onChange={(event) => setName(event.target.value)}
                />
              </label>
              <label className="block text-xs text-foreground/60">
                Player gender
                <select
                  className={`${inputCls} mt-1`}
                  value={gender}
                  onChange={(event) =>
                    setGender(event.target.value as PlayerGender | "")
                  }
                >
                  <option value="">Select gender</option>
                  {PLAYER_GENDER_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs text-foreground/60">
                Email
                <Input
                  className={`${inputCls} mt-1`}
                  type="email"
                  value={email}
                  disabled={Boolean(user?.email)}
                  placeholder="you@example.com"
                  onChange={(event) => setEmail(event.target.value)}
                />
              </label>
              {!user || mode === "sign-in" ? (
                <label className="block text-xs text-foreground/60">
                  Password
                  <Input
                    className={`${inputCls} mt-1`}
                    type="password"
                    value={password}
                    minLength={6}
                    placeholder="At least 6 characters"
                    onChange={(event) => setPassword(event.target.value)}
                  />
                </label>
              ) : null}

              {error ? (
                <p className="flex items-start gap-1.5 rounded-md border border-red-300 bg-red-50 p-2 text-xs text-red-800">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {error}
                </p>
              ) : null}

              <div className="flex flex-wrap items-center gap-2">
                <Button type="submit" size="sm" disabled={busy}>
                  {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
                  {mode === "register" ? "Register" : "Sign in & register"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => {
                    setMode((current) => (current === "register" ? "sign-in" : "register"));
                    setError(null);
                  }}
                >
                  {mode === "register" ? "I already have an account" : "Create an account"}
                </Button>
              </div>
            </form>

            <div className="my-3 flex items-center gap-2 text-xs text-foreground/45">
              <span className="h-px flex-1 bg-sand-dark/30" /> or{" "}
              <span className="h-px flex-1 bg-sand-dark/30" />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              disabled={busy}
              onClick={google}
            >
              Continue with Google
            </Button>
            <p className="mt-3 text-center text-xs">
              <Link
                className="font-semibold text-ocean hover:underline"
                to={`${PLAYER_ROUTE}?id=${encodeURIComponent(id)}`}
              >
                Already assigned to a team? Go to My team
              </Link>
            </p>
          </CardContent>
        </Card>
      )}
    </PageShell>
  );
}
