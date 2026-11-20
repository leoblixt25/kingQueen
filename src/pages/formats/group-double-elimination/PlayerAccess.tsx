import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Loader2,
  LogOut,
  Mail,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GROUP_DOUBLE_ELIMINATION_FORMAT } from "@/formats";
import {
  acceptPairingInvitation,
  cancelPairingInvitation,
  declinePairingInvitation,
  getPairingInvitations,
  getPairingStatusForPlayer,
  isPairingLocked,
  selectAvailablePlayers,
  selectPendingInvitationsForPlayer,
  sendPairingInvitation,
  type PairingStatus,
} from "@/formats/group-double-elimination/pairing";
import { findRegistrationByUid } from "@/formats/group-double-elimination/registration";
import { signOutRegistration } from "@/formats/group-double-elimination/registrationAuth";
import { saveGsdeTournamentAtomic } from "@/formats/group-double-elimination/persistence";
import {
  GsdeMainTitle,
  gsdeHref,
  useGsdeAuth,
  useGsdePlayerRedirect,
  useGsdeTournament,
} from "./shared";
import { GsdePublicShell } from "./PublicShell";

const ROUTE = GROUP_DOUBLE_ELIMINATION_FORMAT.route;
const REGISTER_ROUTE = `${ROUTE}/register`;
const SIGN_IN_ROUTE = `${ROUTE}/sign-in`;

const CARD = "bg-white/80 backdrop-blur-sm border border-sand-dark/20 shadow-beach";
const PRIMARY = "w-full touch-target bg-ocean hover:bg-ocean-dark text-white font-semibold";
const OUTLINE =
  "w-full touch-target bg-white/70 hover:bg-ocean hover:text-white border border-ocean/30 text-ocean font-semibold";

const STATUS_COPY: Record<PairingStatus, { label: string; className: string }> = {
  paired: { label: "Team confirmed", className: "bg-palm/15 text-palm-dark border border-palm/30" },
  "invite-sent": { label: "Invitation sent · Pending", className: "bg-sky-100 text-sky-800" },
  "invite-received": { label: "Invitation received", className: "bg-amber-100 text-amber-800" },
  searching: { label: "Looking for a partner", className: "bg-slate-100 text-slate-700" },
  "pending-approval": { label: "Pending approval", className: "bg-amber-100 text-amber-800" },
  rejected: { label: "Registration rejected", className: "bg-red-100 text-red-700" },
  "not-registered": { label: "Not registered", className: "bg-red-100 text-red-700" },
};

const nameForUid = (
  doc: ReturnType<typeof useGsdeTournament>["doc"],
  uid: string
) => doc?.registrations?.find((item) => item.uid === uid)?.name ?? uid;

/**
 * The player's main page between approval and team confirmation: browse
 * approved players, send invitations, respond to incoming ones and cancel
 * outgoing ones. All mutations are atomic against the live tournament document
 * so both players see the same state and move to My Tournament together.
 */
export default function GroupDoubleEliminationPlayerAccess() {
  const { id, doc, loading: docLoading, error: docError } = useGsdeTournament();
  const { user, loading: authLoading } = useGsdeAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  useGsdePlayerRedirect({
    current: "player-access",
    doc,
    id,
    uid: user?.uid,
    ready: !docLoading && !authLoading,
  });

  const goTo = (route: string) => navigate(gsdeHref(route, id));

  const run = async (
    label: string,
    mutate: (current: NonNullable<typeof doc>) => NonNullable<typeof doc>
  ) => {
    if (!doc) return;
    setBusy(label);
    setActionError(null);
    try {
      await saveGsdeTournamentAtomic(id, mutate);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Could not save that change.");
    } finally {
      setBusy(null);
    }
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOutRegistration();
    } finally {
      setSigningOut(false);
    }
  };

  const registration = doc && user ? findRegistrationByUid(doc, user.uid) : undefined;
  const status = doc && user ? getPairingStatusForPlayer(doc, user.uid) : "not-registered";
  const pending = doc && user ? selectPendingInvitationsForPlayer(doc, user.uid) : [];
  const invitations = doc ? getPairingInvitations(doc) : [];
  const sent = user
    ? invitations.filter(
        (invite) => invite.inviterUid === user.uid && invite.status === "pending"
      )
    : [];
  const available = doc && user ? selectAvailablePlayers(doc, user.uid) : [];
  const locked = doc ? isPairingLocked(doc) : true;

  return (
    <GsdePublicShell
      emoji="🤝"
      title="Find a partner"
      subtitle={`${GROUP_DOUBLE_ELIMINATION_FORMAT.name} · approved players`}
      backTo={gsdeHref(ROUTE, id)}
      backLabel="Tournament"
      showAutoFooter={false}
    >
      {docLoading || authLoading ? (
        <Card className={CARD}>
          <CardContent className="flex items-center justify-center gap-2 p-10 text-sm text-foreground/60">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading your pairing status…
          </CardContent>
        </Card>
      ) : docError ? (
        <Alert className="border-coral/30 bg-coral/10">
          <AlertCircle className="h-4 w-4 text-coral" />
          <AlertDescription className="text-coral">{docError}</AlertDescription>
        </Alert>
      ) : !user ? (
        <Card className={`${CARD} border-ocean/20`}>
          <CardHeader className="pb-2 text-center">
            <CardTitle className="flex flex-col items-center gap-1 text-xl text-ocean">
              <Users className="h-6 w-6" />
              Player access
            </CardTitle>
            <div className="mx-auto w-full max-w-xs">
              <GsdeMainTitle />
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-center text-sm text-foreground/75">
            <p>Sign in to find a partner, or register as an individual player.</p>
            <Button onClick={() => goTo(SIGN_IN_ROUTE)} className={PRIMARY}>
              Sign In
            </Button>
            <Button onClick={() => goTo(REGISTER_ROUTE)} className={OUTLINE}>
              Register
            </Button>
          </CardContent>
        </Card>
      ) : !registration ? (
        <Card className={`${CARD} border-ocean/20`}>
          <CardHeader>
            <CardTitle className="text-center text-xl text-ocean">Register to continue</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-center text-sm text-foreground/75">
            <p>Create an individual registration before looking for a partner.</p>
            <Button onClick={() => goTo(REGISTER_ROUTE)} className={PRIMARY}>
              Register as a player
            </Button>
            <Button variant="outline" onClick={handleSignOut} disabled={signingOut} className={OUTLINE}>
              <LogOut className="h-4 w-4 mr-2" /> Sign out
            </Button>
          </CardContent>
        </Card>
      ) : registration.status !== "approved" ? (
        <Card className={CARD}>
          <CardContent className="flex items-center justify-center gap-2 p-8 text-sm text-foreground/60">
            <Loader2 className="h-4 w-4 animate-spin" />
            Opening your registration status…
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className={`${CARD} border-palm/30`}>
            <CardContent className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-lg font-bold text-foreground">{registration.name}</p>
                  <p className="flex items-center gap-1.5 text-xs text-foreground/60">
                    <Mail className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{registration.email}</span>
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSignOut}
                  disabled={signingOut}
                  className="shrink-0 text-coral hover:bg-coral/10 hover:text-coral"
                >
                  <LogOut className="h-4 w-4 mr-1" /> Sign out
                </Button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge className="bg-palm/15 text-palm-dark border border-palm/30">
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Approved
                </Badge>
                <Badge className={STATUS_COPY[status].className}>
                  {STATUS_COPY[status].label}
                </Badge>
              </div>
              <p className="mt-3 text-center text-xs text-foreground/60">
                Once a partner accepts, both of you move to My Tournament automatically.
              </p>
            </CardContent>
          </Card>

          {actionError ? (
            <Alert className="border-coral/30 bg-coral/10">
              <AlertCircle className="h-4 w-4 text-coral" />
              <AlertDescription className="text-coral">{actionError}</AlertDescription>
            </Alert>
          ) : null}

          {locked ? (
            <Alert className="border-sunset/30 bg-sunset/10">
              <Clock3 className="h-4 w-4 text-sunset" />
              <AlertDescription className="text-sunset-dark">
                Pairing is closed for this tournament.
              </AlertDescription>
            </Alert>
          ) : null}

          {pending.length > 0 ? (
            <Card className={CARD}>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg text-ocean">Invitations for you</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {pending.map((invite) => (
                  <div
                    key={invite.id}
                    className="rounded-xl bg-white/70 border border-sand-dark/20 p-4 space-y-3"
                  >
                    <div className="text-center">
                      <p className="font-bold text-foreground">
                        {nameForUid(doc, invite.inviterUid)}
                      </p>
                      <p className="text-xs text-foreground/60">
                        {invite.category} · wants to be your partner
                      </p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <Button
                        disabled={busy !== null || locked}
                        onClick={() =>
                          run("accept", (current) =>
                            acceptPairingInvitation(current, user.uid, invite.inviterUid)
                          )
                        }
                        className="w-full touch-target bg-palm hover:bg-palm-dark text-white font-semibold"
                      >
                        {busy === "accept" ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                        )}
                        Accept
                      </Button>
                      <Button
                        variant="outline"
                        disabled={busy !== null}
                        onClick={() =>
                          run("decline", (current) =>
                            declinePairingInvitation(current, user.uid, invite.inviterUid)
                          )
                        }
                        className={OUTLINE}
                      >
                        <X className="h-4 w-4 mr-2" /> Decline
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}

          {sent.length > 0 ? (
            <Card className={CARD}>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg text-ocean">Invitation sent</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {sent.map((invite) => (
                  <div
                    key={invite.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white/70 border border-sand-dark/20 p-3"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground">
                        {nameForUid(doc, invite.inviteeUid)}
                      </p>
                      <Badge variant="secondary" className="mt-1">
                        <Clock3 className="h-3 w-3 mr-1" /> Pending
                      </Badge>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy !== null}
                      onClick={() =>
                        run("withdraw", (current) => cancelPairingInvitation(current, user.uid))
                      }
                      className="touch-target text-coral border-coral/30 hover:bg-coral/10 hover:text-coral"
                    >
                      Cancel invitation
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}

          <Card className={CARD}>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg text-ocean">Available players</CardTitle>
              <p className="text-xs text-foreground/60">
                Approved players looking for a partner in the {doc.tournament.config.category} category.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              {available.length === 0 ? (
                <Alert className="border-ocean/30 bg-ocean/10">
                  <AlertDescription>
                    {sent.length > 0 || pending.length > 0
                      ? "You have a pending invitation. It will disappear from this list once it is answered."
                      : "No approved players are available right now. Check back after another player is approved."}
                  </AlertDescription>
                </Alert>
              ) : (
                available.map((player) => (
                  <div
                    key={player.uid}
                    className="rounded-xl bg-white/70 border border-sand-dark/20 p-3 flex flex-wrap items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <p className="font-bold text-foreground">{player.name}</p>
                      <p className="text-xs text-foreground/60 truncate">{player.email}</p>
                    </div>
                    <Button
                      size="sm"
                      disabled={busy !== null || Boolean(sent.length) || pending.length > 0 || locked}
                      onClick={() =>
                        run(`invite-${player.uid}`, (current) =>
                          sendPairingInvitation(current, user.uid, player.uid)
                        )
                      }
                      className="touch-target bg-ocean hover:bg-ocean-dark text-white font-semibold"
                    >
                      {busy === `invite-${player.uid}` ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <UserPlus className="h-4 w-4 mr-1" />
                      )}
                      Invite
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </>
      )}
    </GsdePublicShell>
  );
}
