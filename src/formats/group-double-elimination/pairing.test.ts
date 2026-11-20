import { describe, expect, it } from "vitest";
import {
  createGsdeTournamentDocument,
  fromGsdeFirestoreData,
  toGsdeFirestoreData,
  type GsdeTournamentDocument,
} from "./persistence";
import type { PlayerGender, TournamentCategory } from "./types";
import { approvePlayerRegistration, registerPlayer, ScoringError } from "./scoring";
import {
  getRegisteredTeamId,
  getRegistrations,
  isApprovedUnpairedPlayer,
} from "./registration";
import { validateTournamentIntegrity } from "./integrity";
import {
  acceptPairingInvitation,
  adminChangePairing,
  adminCreatePairTeam,
  adminRemovePairing,
  cancelPairingInvitation,
  createPairTeamId,
  declinePairingInvitation,
  getPairingStatusForPlayer,
  isPairingLocked,
  selectAvailablePlayers,
  selectPendingInvitationsForPlayer,
  selectUnpairedPlayers,
  sendPairingInvitation,
} from "./pairing";

const ADMIN = { id: "admin-1", label: "admin@example.com", isAdmin: true };

const PLAYERS = [
  { uid: "u-m1", email: "m1@example.com", name: "Mateo Smith", gender: "male" as PlayerGender },
  { uid: "u-f1", email: "f1@example.com", name: "Sofia Brown", gender: "female" as PlayerGender },
  { uid: "u-m2", email: "m2@example.com", name: "Noah Wilson", gender: "male" as PlayerGender },
  { uid: "u-f2", email: "f2@example.com", name: "Emma Martin", gender: "female" as PlayerGender },
];

const makeDoc = (category: TournamentCategory = "Mixto"): GsdeTournamentDocument => {
  const base = createGsdeTournamentDocument("event-1");
  return {
    ...base,
    tournament: {
      ...base.tournament,
      config: { ...base.tournament.config, category },
    },
  };
};

const registeredDoc = (
  category: TournamentCategory = "Mixto",
  players = PLAYERS
): GsdeTournamentDocument =>
  players.reduce((doc, player) => registerPlayer(doc, player), makeDoc(category));

const approvedDoc = (
  category: TournamentCategory = "Mixto",
  players = PLAYERS
): GsdeTournamentDocument =>
  players.reduce(
    (doc, player) => approvePlayerRegistration(doc, player.uid, ADMIN),
    registeredDoc(category, players)
  );

const capture = (action: () => unknown): ScoringError => {
  try {
    action();
  } catch (error) {
    if (error instanceof ScoringError) return error;
    throw error;
  }
  throw new Error("Expected a ScoringError");
};

describe("approval-gated pairing", () => {
  it("blocks pending players from browsing, inviting, accepting, declining and cancelling", () => {
    const pending = registeredDoc();
    expect(selectAvailablePlayers(pending, "u-m1")).toEqual([]);
    expect(getPairingStatusForPlayer(pending, "u-m1")).toBe("pending-approval");
    expect(capture(() => sendPairingInvitation(pending, "u-m1", "u-f1")).code).toBe("pairing-invalid");
    expect(capture(() => declinePairingInvitation(pending, "u-f1", "u-m1")).code).toBe("pairing-invalid");
    expect(capture(() => cancelPairingInvitation(pending, "u-m1")).code).toBe("pairing-invalid");

    const approved = approvedDoc();
    const invited = sendPairingInvitation(approved, "u-m1", "u-f1");
    const pendingAgain: GsdeTournamentDocument = {
      ...invited,
      registrations: getRegistrations(invited).map((item) => ({ ...item, status: "pending" as const })),
    };
    expect(capture(() => acceptPairingInvitation(pendingAgain, "u-f1", "u-m1")).code).toBe("pairing-invalid");
  });

  it("offers only compatible approved, unpaired players", () => {
    const doc = approvedDoc("Mixto");
    expect(selectAvailablePlayers(doc, "u-m1").map((p) => p.uid)).toEqual(["u-f1", "u-f2"]);
    expect(selectAvailablePlayers(doc, "u-f1").map((p) => p.uid)).toEqual(["u-m1", "u-m2"]);
    expect(selectUnpairedPlayers(doc)).toHaveLength(4);

    const male = approvedDoc("Male");
    expect(selectAvailablePlayers(male, "u-m1").map((p) => p.uid)).toEqual(["u-m2"]);
    const female = approvedDoc("Female");
    expect(selectAvailablePlayers(female, "u-m1")).toEqual([]);
  });

  it("keeps invitations separate from registrations and teams until acceptance", () => {
    const doc = approvedDoc();
    const invited = sendPairingInvitation(doc, "u-m1", "u-f1");

    expect(invited.teams).toHaveLength(0);
    expect(invited.registrations).toEqual(doc.registrations);
    expect(invited.pairingInvitations?.["u-m1"].status).toBe("pending");
    expect(selectPendingInvitationsForPlayer(invited, "u-f1")).toHaveLength(1);
    expect(getPairingStatusForPlayer(invited, "u-m1")).toBe("invite-sent");
    expect(getPairingStatusForPlayer(invited, "u-f1")).toBe("invite-received");
    expect(validateTournamentIntegrity(invited)).toEqual([]);
  });

  it("rejects an invitation that breaks the selected category", () => {
    const error = capture(() => sendPairingInvitation(approvedDoc("Mixto"), "u-m1", "u-m2"));
    expect(error.code).toBe("pairing-unavailable");
  });

  it("creates exactly one confirmed team on acceptance without editing registrations", () => {
    const doc = approvedDoc();
    const invited = sendPairingInvitation(doc, "u-m1", "u-f1");
    const accepted = acceptPairingInvitation(invited, "u-f1", "u-m1");

    const teamId = createPairTeamId("u-m1", "u-f1");
    expect(accepted.teams).toHaveLength(1);
    expect(accepted.teams[0]).toMatchObject({
      id: teamId,
      name: "Mateo Smith / Sofia Brown",
      playerIds: ["u-m1", "u-f1"],
      status: "confirmed",
      groupId: null,
    });
    expect(accepted.registrations).toEqual(doc.registrations);
    expect(getRegisteredTeamId(accepted, "u-m1")).toBe(teamId);
    expect(getRegisteredTeamId(accepted, "u-f1")).toBe(teamId);
    expect(accepted.playerPairingIndex?.["u-m1"]).toEqual({ status: "approved", teamId });
    expect(accepted.playerPairingIndex?.["u-f1"]).toEqual({ status: "approved", teamId });
    expect(getPairingStatusForPlayer(accepted, "u-m1")).toBe("paired");
    expect(isApprovedUnpairedPlayer(accepted, "u-m1")).toBe(false);
    expect(selectUnpairedPlayers(accepted).map((p) => p.uid)).toEqual(["u-m2", "u-f2"]);
    expect(validateTournamentIntegrity(accepted)).toEqual([]);
  });

  it("prevents a player from joining a second team or accepting twice", () => {
    let doc = approvedDoc();
    doc = acceptPairingInvitation(sendPairingInvitation(doc, "u-m1", "u-f1"), "u-f1", "u-m1");
    expect(capture(() => sendPairingInvitation(doc, "u-m1", "u-f2")).code).toBe("pairing-unavailable");
    expect(capture(() => sendPairingInvitation(doc, "u-m2", "u-f1")).code).toBe("pairing-unavailable");

    const second = sendPairingInvitation(doc, "u-m2", "u-f2");
    const acceptedSecond = acceptPairingInvitation(second, "u-f2", "u-m2");
    expect(acceptedSecond.teams).toHaveLength(2);
    expect(new Set(acceptedSecond.teams.flatMap((team) => team.playerIds)).size).toBe(4);
    expect(capture(() => acceptPairingInvitation(acceptedSecond, "u-f2", "u-m2")).code).toBe("pairing-invalid");
  });

  it("declines and cancels without creating a team", () => {
    const doc = approvedDoc();
    const invited = sendPairingInvitation(doc, "u-m1", "u-f1");
    const declined = declinePairingInvitation(invited, "u-f1", "u-m1");
    expect(declined.teams).toHaveLength(0);
    expect(declined.pairingInvitations?.["u-m1"].status).toBe("declined");

    const fresh = sendPairingInvitation(declined, "u-m2", "u-f1");
    expect(fresh.pairingInvitations?.["u-m2"].status).toBe("pending");

    const cancelled = cancelPairingInvitation(fresh, "u-m2");
    expect(cancelled.teams).toHaveLength(0);
    expect(cancelled.pairingInvitations?.["u-m2"].status).toBe("cancelled");
    expect(selectAvailablePlayers(cancelled, "u-m2").map((p) => p.uid)).toContain("u-f1");
    expect(validateTournamentIntegrity(cancelled)).toEqual([]);
  });
});

describe("admin team management", () => {
  it("creates a confirmed team from approved unpaired players without changing approval", () => {
    const before = approvedDoc();
    const doc = adminCreatePairTeam(before, "u-m1", "u-f1", ADMIN);
    const teamId = createPairTeamId("u-m1", "u-f1");

    expect(doc.teams[0]).toMatchObject({
      id: teamId,
      name: "Mateo Smith / Sofia Brown",
      playerIds: ["u-m1", "u-f1"],
      status: "confirmed",
    });
    expect(doc.registrations.map((item) => item.status)).toEqual(
      before.registrations.map((item) => item.status)
    );
    expect(getRegisteredTeamId(doc, "u-m1")).toBe(teamId);
    expect(getRegisteredTeamId(doc, "u-f1")).toBe(teamId);
    expect(validateTournamentIntegrity(doc)).toEqual([]);
  });

  it("refuses to create a team from pending or paired players", () => {
    const pending = registeredDoc();
    expect(capture(() => adminCreatePairTeam(pending, "u-m1", "u-f1", ADMIN)).code).toBe("pairing-invalid");

    const paired = adminCreatePairTeam(approvedDoc(), "u-m1", "u-f1", ADMIN);
    expect(capture(() => adminCreatePairTeam(paired, "u-m1", "u-f2", ADMIN)).code).toBe("pairing-unavailable");
  });

  it("changes team membership without changing approval or duplicating players", () => {
    let doc = adminCreatePairTeam(approvedDoc(), "u-m1", "u-f1", ADMIN);
    const firstId = createPairTeamId("u-m1", "u-f1");
    doc = adminChangePairing(doc, firstId, "u-m2", "u-f1", ADMIN);

    expect(doc.teams).toHaveLength(1);
    expect(doc.teams[0]).toMatchObject({
      id: firstId,
      playerIds: ["u-m2", "u-f1"],
      name: "Noah Wilson / Sofia Brown",
      status: "confirmed",
    });
    expect(getRegisteredTeamId(doc, "u-m1")).toBeNull();
    expect(getRegisteredTeamId(doc, "u-m2")).toBe(firstId);
    expect(doc.registrations.every((item) => item.status === "approved")).toBe(true);
    expect(isApprovedUnpairedPlayer(doc, "u-m1")).toBe(true);
    expect(validateTournamentIntegrity(doc)).toEqual([]);
  });

  it("dissolves a team and preserves both approved players", () => {
    let doc = adminCreatePairTeam(approvedDoc(), "u-m1", "u-f1", ADMIN);
    const teamId = createPairTeamId("u-m1", "u-f1");
    doc = adminRemovePairing(doc, teamId, ADMIN);

    expect(doc.teams).toHaveLength(0);
    expect(doc.registrations.every((item) => item.status === "approved")).toBe(true);
    expect(getRegisteredTeamId(doc, "u-m1")).toBeNull();
    expect(getRegisteredTeamId(doc, "u-f1")).toBeNull();
    expect(selectUnpairedPlayers(doc)).toHaveLength(4);
    expect(validateTournamentIntegrity(doc)).toEqual([]);
  });
});

describe("pairing lifecycle and persistence", () => {
  it("locks pairing once the tournament moves past configuration", () => {
    const invited = sendPairingInvitation(approvedDoc(), "u-m1", "u-f1");
    const locked: GsdeTournamentDocument = {
      ...invited,
      tournament: { ...invited.tournament, status: "group-stage" },
    };
    expect(isPairingLocked(locked)).toBe(true);
    expect(selectAvailablePlayers(locked, "u-m1")).toEqual([]);
    expect(capture(() => sendPairingInvitation(locked, "u-m2", "u-f2")).code).toBe(
      "registration-closed"
    );
    expect(capture(() => acceptPairingInvitation(locked, "u-f1", "u-m1")).code).toBe(
      "registration-closed"
    );
    expect(capture(() => declinePairingInvitation(locked, "u-f1", "u-m1")).code).toBe(
      "registration-closed"
    );
    expect(capture(() => cancelPairingInvitation(locked, "u-m1")).code).toBe(
      "registration-closed"
    );
  });

  it("round-trips invitations and the derived pairing index through Firestore", () => {
    const accepted = acceptPairingInvitation(
      sendPairingInvitation(approvedDoc(), "u-m1", "u-f1"),
      "u-f1",
      "u-m1"
    );
    const restored = fromGsdeFirestoreData(toGsdeFirestoreData(accepted), accepted.id);
    expect(restored?.pairingInvitations).toEqual(accepted.pairingInvitations);
    expect(restored?.pairingResponses).toEqual(accepted.pairingResponses);
    expect(restored?.playerPairingIndex).toEqual(accepted.playerPairingIndex);

    const { pairingInvitations, pairingResponses, ...legacy } = toGsdeFirestoreData(accepted);
    const legacyRestored = fromGsdeFirestoreData(legacy, accepted.id);
    expect(legacyRestored?.pairingInvitations).toEqual({});
    expect(legacyRestored?.pairingResponses).toEqual({});
    expect(legacyRestored?.playerPairingIndex).toEqual(accepted.playerPairingIndex);
  });
});
