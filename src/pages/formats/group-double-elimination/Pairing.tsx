import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, CheckCircle2, Clock3, Loader2, Mail, UserPlus, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GROUP_DOUBLE_ELIMINATION_FORMAT } from "@/formats";
import { resolveTeamDisplayName } from "@/formats/group-double-elimination/category";
import { validateTeamCategory } from "@/formats/group-double-elimination/category";
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
import { findRegistrationByUid, getRegisteredTeamId } from "@/formats/group-double-elimination/registration";
import { PageShell, useGsdeAuth, useGsdeTournament } from "./shared";

const REGISTER_ROUTE = `${GROUP_DOUBLE_ELIMINATION_FORMAT.route}/register`;
const PENDING_ROUTE = `${GROUP_DOUBLE_ELIMINATION_FORMAT.route}/register/pending`;
const PLAYER_ROUTE = `${GROUP_DOUBLE_ELIMINATION_FORMAT.route}/player`;

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

export default function GroupDoubleEliminationPairing() {
  const { id, doc, loading: docLoading, error: docError } = useGsdeTournament();
  const { user, loading: authLoading } = useGsdeAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const goTo = (route: string) => navigate(`${route}?id=${encodeURIComponent(id)}`);

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
    <PageShell
      title="Find a partner"
      subtitle={`${GROUP_DOUBLE_ELIMINATION_FORMAT.name} · individual player pairing`}
      backTo={`${GROUP_DOUBLE_ELIMINATION_FORMAT.route}/register/pending?id=${encodeURIComponent(id)}`}
      backLabel="Registration status"
    >
      {docLoading || authLoading ? (
        <Card className="border-sand-dark/40 shadow-beach bg-card/95">
          <CardContent className="flex items-center justify-center gap-2 p-10 text-sm text-foreground/60">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading pairing…
          </CardContent>
        </Card>
      ) : docError ? (
        <Card className="border-red-300 bg-red-50">
          <CardContent className="p-5 text-sm text-red-800">{docError}</CardContent>
        </Card>
      ) : !user ? (
        <Card className="border-sand-dark/40 shadow-beach bg-card/95">
          <CardContent className="space-y-3 p-5 text-sm text-foreground/75">
            <p>Sign in with your player account to find a partner.</p>
            <Button size="sm" onClick={() => goTo(REGISTER_ROUTE)}>Sign in or register</Button>
          </CardContent>
        </Card>
      ) : !registration ? (
        <Card className="border-sand-dark/40 shadow-beach bg-card/95">
          <CardContent className="space-y-3 p-5 text-sm text-foreground/75">
            <p>You must register as an individual player before inviting a partner.</p>
            <Button size="sm" onClick={() => goTo(REGISTER_ROUTE)}>Register as a player</Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="border-sand-dark/40 shadow-beach bg-card/95">
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4" /> {registration.name}
                </CardTitle>
                <Badge className={STATUS_COPY[status].className}>{STATUS_COPY[status].label}</Badge>
              </div>
              <CardDescription className="flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" /> {registration.email}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-foreground/75">
              <p>Category: <strong>{doc.tournament.config.category}</strong></p>
              {pairedTeam && doc ? (
                <p>
                  Your team: <strong>{resolveTeamDisplayName(doc.registrations ?? [], pairedTeam)}</strong>
                  {" · "}
                  {validateTeamCategory(doc, pairedTeam).length === 0
                    ? "valid category, waiting for admin approval"
                    : "awaiting admin review"}
                </p>
              ) : null}
              {locked ? (
                <p className="flex items-center gap-1.5 text-amber-700">
                  <Clock3 className="h-4 w-4" /> Pairing is locked for this tournament.
                </p>
              ) : null}
              <Button size="sm" variant="outline" onClick={() => goTo(PENDING_ROUTE)}>
                View registration status
              </Button>
              {pairedTeam ? (
                <Button size="sm" variant="outline" onClick={() => goTo(PLAYER_ROUTE)}>
                  Open My team
                </Button>
              ) : null}
            </CardContent>
          </Card>

          {actionError ? (
            <Card className="border-red-300 bg-red-50">
              <CardContent className="flex items-start gap-2 p-4 text-sm text-red-800">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {actionError}
              </CardContent>
            </Card>
          ) : null}

          {pending.length > 0 ? (
            <Card className="border-sand-dark/40 shadow-beach bg-card/95">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Invitations for you</CardTitle>
                <CardDescription>Accept to form a team, or decline to keep looking.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {pending.map((invite) => (
                  <div key={invite.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-sand-dark/30 p-3">
                    <div className="text-sm">
                      <p className="font-semibold">{nameForUid(doc, invite.inviterUid)}</p>
                      <p className="text-foreground/60">
                        {playerForUid(doc, invite.inviterUid)?.email ?? ""} · {invite.category}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        disabled={busy !== null || locked}
                        onClick={() =>
                          run("accept", () => acceptPairingInvitation(doc!, user.uid, invite.inviterUid))
                        }
                      >
                        {busy === "accept" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy !== null}
                        onClick={() =>
                          run("decline", () => declinePairingInvitation(doc!, user.uid, invite.inviterUid))
                        }
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
            <Card className="border-sand-dark/40 shadow-beach bg-card/95">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Invitation sent</CardTitle>
                <CardDescription>
                  Waiting for {nameForUid(doc, sent.inviteeUid)} to accept or decline.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy !== null}
                  onClick={() => run("withdraw", () => cancelPairingInvitation(doc!, user.uid))}
                >
                  Withdraw invitation
                </Button>
              </CardContent>
            </Card>
          ) : null}

          <Card className="border-sand-dark/40 shadow-beach bg-card/95">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Available players</CardTitle>
              <CardDescription>
                Only registered players compatible with {doc.tournament.config.category} are shown.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {locked ? (
                <p className="text-sm text-foreground/60">Pairing is closed.</p>
              ) : available.length === 0 ? (
                <p className="text-sm text-foreground/60">
                  No compatible unpaired players are available right now.
                </p>
              ) : (
                available.map((player) => (
                  <div key={player.uid} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-sand-dark/30 p-3">
                    <div className="text-sm">
                      <p className="font-semibold">{player.name}</p>
                      <p className="flex items-center gap-1.5 text-foreground/60">
                        <Mail className="h-3.5 w-3.5" /> {player.email}
                        <Badge variant="secondary" className="ml-1 capitalize">{player.gender}</Badge>
                      </p>
                    </div>
                    <Button
                      size="sm"
                      disabled={busy !== null || Boolean(pairedTeamId) || Boolean(sent) || pending.length > 0}
                      onClick={() =>
                        run(`invite-${player.uid}`, () => sendPairingInvitation(doc!, user.uid, player.uid))
                      }
                    >
                      {busy === `invite-${player.uid}` ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <UserPlus className="h-4 w-4" />
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
    </PageShell>
  );
}
