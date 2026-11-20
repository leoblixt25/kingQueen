import type { GsdeTournamentDocument } from "./persistence";
import { findRegistrationByUid, getRegisteredTeamId } from "./registration";
import type { PlayerRegistration } from "./types";

/**
 * One authoritative answer to "which screen should this player see?".
 *
 * The destination is derived from the live tournament document only: approval
 * state from the registration, and team membership from `team.playerIds` via
 * `getRegisteredTeamId`. Invitations never change the destination — a player
 * stays on the pairing dashboard while an invitation is pending, and BOTH
 * players move to My Tournament as soon as the accepted team exists.
 */
export type GsdePlayerDestination =
  | "register"
  | "register-pending"
  | "player-access"
  | "my-tournament";

export const destinationForRegistration = (
  doc: GsdeTournamentDocument,
  registration: PlayerRegistration
): GsdePlayerDestination => {
  // Pending and rejected registrations stay on the status page until an admin
  // changes the decision. Neither can reach pairing or the tournament view.
  if (registration.status === "pending" || registration.status === "rejected") {
    return "register-pending";
  }
  // `getRegisteredTeamId` is approval-gated and reads actual team membership,
  // so a dissolved team immediately sends the player back to pairing.
  if (getRegisteredTeamId(doc, registration.uid)) return "my-tournament";
  // Approved, no team — searching, invite-sent and invite-received all live
  // on the same pairing dashboard.
  return "player-access";
};

/**
 * Resolve a destination for a signed-in player. Returns `null` when auth or
 * tournament data is still loading so callers do not redirect on a partial
 * snapshot.
 */
export const resolvePlayerDestination = (
  doc: GsdeTournamentDocument | null,
  uid: string | null | undefined
): GsdePlayerDestination | null => {
  if (!doc || !uid) return null;
  const registration = findRegistrationByUid(doc, uid);
  return registration ? destinationForRegistration(doc, registration) : "register";
};
