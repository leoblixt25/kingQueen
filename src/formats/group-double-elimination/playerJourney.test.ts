import { describe, expect, it } from "vitest";
import type { AuditActor } from "./audit";
import { createGsdeTournamentDocument } from "./persistence";
import { resolvePlayerDestination } from "./playerRouting";
import {
  acceptPairingInvitation,
  adminRemovePairing,
  createPairTeamId,
  sendPairingInvitation,
} from "./pairing";
import {
  approvePlayerRegistration,
  rejectPlayerRegistration,
  registerPlayer,
} from "./scoring";

const ADMIN: AuditActor = { id: "admin-1", label: "admin@test.test", isAdmin: true };

const PLAYER_A = {
  uid: "player-a",
  email: "a@test.test",
  name: "Player A",
  gender: "male" as const,
};
const PLAYER_B = {
  uid: "player-b",
  email: "b@test.test",
  name: "Player B",
  gender: "female" as const,
};

const registered = () =>
  [PLAYER_A, PLAYER_B].reduce(
    (doc, player) => registerPlayer(doc, player),
    createGsdeTournamentDocument("journey-test")
  );

describe("GSDE player journey routing", () => {
  it("maps registration and approval states to the right screen", () => {
    const doc = registered();

    expect(resolvePlayerDestination(doc, PLAYER_A.uid)).toBe("register-pending");
    expect(resolvePlayerDestination(doc, "unknown-uid")).toBe("register");

    const approved = approvePlayerRegistration(doc, PLAYER_A.uid, ADMIN);
    expect(resolvePlayerDestination(approved, PLAYER_A.uid)).toBe("player-access");

    const rejected = rejectPlayerRegistration(doc, PLAYER_A.uid, ADMIN);
    expect(resolvePlayerDestination(rejected, PLAYER_A.uid)).toBe("register-pending");
  });

  it("keeps both players on pairing while an invitation is pending", () => {
    const approved = [PLAYER_A, PLAYER_B].reduce(
      (doc, player) => approvePlayerRegistration(doc, player.uid, ADMIN),
      registered()
    );
    const invited = sendPairingInvitation(approved, PLAYER_A.uid, PLAYER_B.uid, ADMIN);

    expect(resolvePlayerDestination(invited, PLAYER_A.uid)).toBe("player-access");
    expect(resolvePlayerDestination(invited, PLAYER_B.uid)).toBe("player-access");
  });

  it("moves BOTH players to My Tournament when the invitee accepts", () => {
    const approved = [PLAYER_A, PLAYER_B].reduce(
      (doc, player) => approvePlayerRegistration(doc, player.uid, ADMIN),
      registered()
    );
    const invited = sendPairingInvitation(approved, PLAYER_A.uid, PLAYER_B.uid, ADMIN);
    const paired = acceptPairingInvitation(invited, PLAYER_B.uid, PLAYER_A.uid, ADMIN);

    const teamId = createPairTeamId(PLAYER_A.uid, PLAYER_B.uid);
    expect(paired.teams.filter((team) => team.id === teamId)).toHaveLength(1);
    expect(paired.teams.find((team) => team.id === teamId)?.playerIds).toEqual([
      PLAYER_A.uid,
      PLAYER_B.uid,
    ]);
    // Pairing deliberately leaves registration.teamId null; membership comes
    // from team.playerIds and that is what the resolver reads.
    expect(
      paired.registrations?.find((item) => item.uid === PLAYER_A.uid)?.teamId
    ).toBeNull();
    expect(resolvePlayerDestination(paired, PLAYER_A.uid)).toBe("my-tournament");
    expect(resolvePlayerDestination(paired, PLAYER_B.uid)).toBe("my-tournament");
  });

  it("sends both players back to pairing if the team is dissolved", () => {
    const approved = [PLAYER_A, PLAYER_B].reduce(
      (doc, player) => approvePlayerRegistration(doc, player.uid, ADMIN),
      registered()
    );
    const invited = sendPairingInvitation(approved, PLAYER_A.uid, PLAYER_B.uid, ADMIN);
    const paired = acceptPairingInvitation(invited, PLAYER_B.uid, PLAYER_A.uid, ADMIN);
    const teamId = createPairTeamId(PLAYER_A.uid, PLAYER_B.uid);
    const dissolved = adminRemovePairing(paired, teamId, ADMIN);

    expect(resolvePlayerDestination(dissolved, PLAYER_A.uid)).toBe("player-access");
    expect(resolvePlayerDestination(dissolved, PLAYER_B.uid)).toBe("player-access");
  });

  it("waits for data instead of redirecting on a partial snapshot", () => {
    const doc = registered();
    expect(resolvePlayerDestination(null, PLAYER_A.uid)).toBeNull();
    expect(resolvePlayerDestination(doc, null)).toBeNull();
    expect(resolvePlayerDestination(doc, undefined)).toBeNull();
  });
});
