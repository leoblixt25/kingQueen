import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Loader2,
  Mail,
  UserPlus,
  Users,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GROUP_DOUBLE_ELIMINATION_FORMAT } from "@/formats";
import {
  resolveTeamDisplayName,
  validateTeamCategory,
} from "@/formats/group-double-elimination/category";
import { saveGsdeTournament } from "@/formats/group-double-elimination/persistence";
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
import {
  findRegistrationByUid,
  getRegisteredTeamId,
} from "@/formats/group-double-elimination/registration";
import { gsdeHref, useGsdeAuth, useGsdeTournament } from "./shared";
import { GsdePublicShell } from "./PublicShell";

const ROUTE = GROUP_DOUBLE_ELIMINATION_FORMAT.route;
const REGISTER_ROUTE = `${ROUTE}/register`;
const PENDING_ROUTE = `${ROUTE}/register/pending`;
const PLAYER_ROUTE = `${ROUTE}/player`;

const CARD = "bg-white/80 backdrop-blur-sm border border-sand-dark/20 shadow-beach";
const PRIMARY = "w-full touch-target bg-ocean hover:bg-ocean-dark text-white font-semibold";
const OUTLINE =
  "w-full touch-target bg-white/70 hover:bg-ocean hover:text-white border border-ocean/30 text-ocean font-semibold";

const STATUS_COPY: Record<PairingStatus, { label: string; className: string }> = {
  paired: { label: "Paired · awaiting admin approval", className: "bg-emerald-100 text-emerald-800" },
  "invite-sent": { label: "Invitation sent", className: "bg-sky-100 text-sky-800" },
  "invite-received": { label: "Invitation received", className: "bg-amber-100 text-amber-800" },
  searching: { label: "Looking for a partner", className: "bg-slate-100 text-slate-700" },
  "not-registered": { label: "Not registered", className: "bg-red-100 text-red-700" },
};

const playerForUid = (
  doc: ReturnType<typeof useGsdeTournament>["doc"],
  uid: string
) => doc?.registrations?.find((item) => item.uid === uid);

const nameForUid = (
  doc: ReturnType<typeof useGsdeTournament>["doc"],
  uid: string
) => playerForUid(doc, uid)?.name ?? uid;

/** K&Q-style partner-finding screen, scoped to the isolated GSDE flow. */
export default function GroupDoubleEliminationPairing() {
  const { id, doc, loading: docLoading, error: docError } = useGsdeTournament();
  const { user, loading: authLoading } = useGsdeAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const goTo = (route: string) => navigate(gsdeHref(route, id));

  const run = async (label: string, mutate: () => NonNullable<typeof doc>) => {
    if (!doc) return;
    setBusy(label);
    setActionError(null);
    try {
      await saveGsdeTournament(mutate());
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Could not save that change.");
    } finally {
      setBusy(null);
    }
  };

  const registration = doc && user ? findRegistrationByUid(doc, user.uid) : undefined;
  const status = doc && user ? getPairingStatusForPlayer(doc, user.uid) : "not-registered";
  const pairedTeamId = doc && user ? getRegisteredTeamId(doc, user.uid) : null;
  const pairedTeam = pairedTeamId ? doc?.teams.find((team) => team.id === pairedTeamId) : undefined;
  const pending = doc && user ? selectPendingInvitationsForPlayer(doc, user.uid) : [];
  const invitations = doc ? getPairingInvitations(doc) : [];
  const sent = user
    ? invitations.find((invite) => invite.inviterUid === user.uid && invite.status === "pending")
    : undefined;
  const available = doc && user ? selectAvailablePlayers(doc, user.uid) : [];
  const locked = doc ? isPairingLocked(doc) : true;

  return (
    <GsdePublicShell
      emoji="🤝"
      title="Find a partner"
      subtitle={`${GROUP_DOUBLE_ELIMINATION_FORMAT.name} · individual player pairing`}
      backTo={gsdeHref(PENDING_ROUTE, id)}
      backLabel="Registration status"
      showAutoFooter={false}
    >
      {docLoading || authLoading ? (
        <Card className={CARD}>
          <CardContent className="flex items-center justify-center gap-2 p-10 text-sm text-foreground/60">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading pairing…
          </CardContent>
        </Card>
      ) : docError ? (
        <Alert className="border-coral/30 bg-coral/10">
          <AlertCircle className="h-4 w-4 text-coral" />
          <AlertDescription className="text-coral">{docError}</AlertDescription>
        </Alert>
      ) : !user ? (
        <Card className={`${CARD} border-coral/20`}>
          <CardHeader>
            <CardTitle className="text-center text-coral">Sign In Required</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-center text-sm text-foreground/75">
            <p>Sign in with your player account to find a partner.</p>
            <Button onClick={() => goTo(REGISTER_ROUTE)} className={PRIMARY}>
              Sign in or register
            </Button>
          </CardContent>
        </Card>
      ) : !registration ? (
        <Card className={`${CARD} border-coral/20`}>
          <CardHeader>
            <CardTitle className="text-center text-coral">Registration Required</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-center text-sm text-foreground/75">
            <p>Register as an individual player before inviting a partner.</p>
            <Button onClick={() => goTo(REGISTER_ROUTE)} className={PRIMARY}>
              Register as a player
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className={CARD}>
            <CardHeader className="pb-3 text-center">
              <CardTitle className="flex items-center justify-center gap-2 text-xl text-ocean">
                <Users className="h-5 w-5" />
                {registration.name}
              </CardTitle>
              <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
                <Badge className={STATUS_COPY[status].className}>{STATUS_COPY[status].label}</Badge>
              </div>
              <p className="flex items-center justify-center gap-1.5 text-sm text-foreground/70">
                <Mail className="h-3.5 w-3.5" /> {registration.email}
              </p>
            </CardHeader>
            <CardContent className="space-y-3 text-center text-sm text-foreground/75">
              <p>
                Category: <strong>{doc.tournament.config.category}</strong>
              </p>
              {pairedTeam && doc ? (
                <p>
                  Your team:{" "}
                  <strong>{resolveTeamDisplayName(doc.registrations ?? [], pairedTeam)}</strong>
                  {" · "}
                  {validateTeamCategory(doc, pairedTeam).length === 0
                    ? "valid category, waiting for admin approval"
                    : "awaiting admin review"}
                </p>
              ) : null}
              {locked ? (
                <Alert className="border-sunset/30 bg-sunset/10">
                  <Clock3 className="h-4 w-4 text-sunset" />
                  <AlertDescription className="text-sunset-dark">
                    Pairing is locked for this tournament.
                  </AlertDescription>
                </Alert>
              ) : null}
              <div className="space-y-3 pt-2">
                <Button onClick={() => goTo(PENDING_ROUTE)} className={OUTLINE}>
                  View registration status
                </Button>
                {pairedTeam ? (
                  <Button onClick={() => goTo(PLAYER_ROUTE)} className={PRIMARY}>
                    <Users className="w-4 h-4 mr-2" />
                    Open My team
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>

          {actionError ? (
            <Alert className="border-coral/30 bg-coral/10">
              <AlertCircle className="h-4 w-4 text-coral" />
              <AlertDescription className="text-coral">{actionError}</AlertDescription>
            </Alert>
          ) : null}

          {pending.length > 0 ? (
            <Card className={CARD}>
              <CardHeader className="pb-3 text-center">
                <CardTitle className="text-xl text-ocean">Invitations for you</CardTitle>
                <p className="text-sm text-foreground/70">
                  Accept to form a team, or decline to keep looking.
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                {pending.map((invite) => (
                  <div
                    key={invite.id}
                    className="rounded-xl bg-white/70 border border-sand-dark/20 p-4 space-y-3"
                  >
                    <div className="text-center text-sm">
                      <p className="font-bold text-foreground">
                        {nameForUid(doc, invite.inviterUid)}
                      </p>
                      <p className="text-foreground/60">
                        {playerForUid(doc, invite.inviterUid)?.email ?? ""} · {invite.category}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Button
                        disabled={busy !== null || locked}
                        onClick={() =>
                          run("accept", () => acceptPairingInvitation(doc!, user.uid, invite.inviterUid))
                        }
                        className={PRIMARY}
                      >
                        {busy === "accept" ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                        )}
                        Accept invitation
                      </Button>
                      <Button
                        variant="outline"
                        disabled={busy !== null}
                        onClick={() =>
                          run("decline", () => declinePairingInvitation(doc!, user.uid, invite.inviterUid))
                        }
                        className={OUTLINE}
                      >
                        Decline
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}

          {sent ? (
            <Card className={CARD}>
              <CardHeader className="pb-3 text-center">
                <CardTitle className="text-xl text-ocean">Invitation sent</CardTitle>
                <p className="text-sm text-foreground/70">
                  Waiting for {nameForUid(doc, sent.inviteeUid)} to accept or decline.
                </p>
              </CardHeader>
              <CardContent>
                <Button
                  variant="outline"
                  disabled={busy !== null}
                  onClick={() => run("withdraw", () => cancelPairingInvitation(doc!, user.uid))}
                  className={OUTLINE}
                >
                  Withdraw invitation
                </Button>
              </CardContent>
            </Card>
          ) : null}

          <Card className={CARD}>
            <CardHeader className="pb-3 text-center">
              <CardTitle className="text-xl text-ocean">Available players</CardTitle>
              <p className="text-sm text-foreground/70">
                Only players compatible with {doc.tournament.config.category} are shown.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              {locked ? (
                <Alert className="border-sunset/30 bg-sunset/10">
                  <Clock3 className="h-4 w-4 text-sunset" />
                  <AlertDescription className="text-sunset-dark">
                    Pairing is closed.
                  </AlertDescription>
                </Alert>
              ) : available.length === 0 ? (
                <Alert className="border-ocean/30 bg-ocean/10">
                  <AlertDescription>
                    No compatible unpaired players are available right now.
                  </AlertDescription>
                </Alert>
              ) : (
                available.map((player) => (
                  <div
                    key={player.uid}
                    className="rounded-xl bg-white/70 border border-sand-dark/20 p-4 space-y-3"
                  >
                    <div className="text-center text-sm">
                      <p className="font-bold text-foreground">{player.name}</p>
                      <p className="flex flex-wrap items-center justify-center gap-1.5 text-foreground/60">
                        <Mail className="h-3.5 w-3.5" /> {player.email}
                        <Badge variant="secondary" className="capitalize">{player.gender}</Badge>
                      </p>
                    </div>
                    <Button
                      disabled={
                        busy !== null || Boolean(pairedTeamId) || Boolean(sent) || pending.length > 0
                      }
                      onClick={() =>
                        run(`invite-${player.uid}`, () => sendPairingInvitation(doc!, user.uid, player.uid))
                      }
                      className={PRIMARY}
                    >
                      {busy === `invite-${player.uid}` ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <UserPlus className="h-4 w-4 mr-2" />
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
