import { describe, expect, it } from "vitest";
import { createGsdeTournamentDocument, fromGsdeFirestoreData, toGsdeFirestoreData, type GsdeTournamentDocument } from "./persistence";
import type { PlayerGender, TournamentCategory } from "./types";
import { registerPlayer, ScoringError } from "./scoring";
import { getRegisteredTeamId } from "./registration";
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

const capture = (action: () => unknown): ScoringError => {
  try {
    action();
  } catch (error) {
    if (error instanceof ScoringError) return error;
    throw error;
  }
  throw new Error("Expected a ScoringError");
};

describe("GSDE player pairing", () => {
  it("only offers compatible registered players for the selected category", () => {
    const doc = registeredDoc("Mixto");
    expect(selectAvailablePlayers(doc, "u-m1").map((p) => p.uid)).toEqual(["u-f1", "u-f2"]);
    expect(selectAvailablePlayers(doc, "u-f1").map((p) => p.uid)).toEqual(["u-m1", "u-m2"]);

    const male = registeredDoc("Male");
    expect(selectAvailablePlayers(male, "u-m1").map((p) => p.uid)).toEqual(["u-m2"]);
    const female = registeredDoc("Female");
    expect(selectAvailablePlayers(female, "u-m1")).toEqual([]);
  });

  it("keeps the invitation separate from registrations and teams until acceptance", () => {
    const doc = registeredDoc();
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
    const error = capture(() => sendPairingInvitation(registeredDoc("Mixto"), "u-m1", "u-m2"));
    expect(error.code).toBe("pairing-unavailable");
  });

  it("creates one pending team and links both players when accepted", () => {
    const doc = registeredDoc();
    const invited = sendPairingInvitation(doc, "u-m1", "u-f1");
    const accepted = acceptPairingInvitation(invited, "u-f1", "u-m1");

    const teamId = createPairTeamId("u-m1", "u-f1");
    expect(accepted.teams).toHaveLength(1);
    expect(accepted.teams[0]).toMatchObject({
      id: teamId,
      name: "Mateo Smith / Sofia Brown",
      playerIds: ["u-m1", "u-f1"],
      status: "pending",
      groupId: null,
    });
    expect(getRegisteredTeamId(accepted, "u-m1")).toBe(teamId);
    expect(getRegisteredTeamId(accepted, "u-f1")).toBe(teamId);
    expect(getPairingStatusForPlayer(accepted, "u-m1")).toBe("paired");
    expect(selectUnpairedPlayers(accepted).map((p) => p.uid)).toEqual(["u-m2", "u-f2"]);
    expect(validateTournamentIntegrity(accepted)).toEqual([]);
  });

  it("prevents a player from joining a second team or accepting twice", () => {
    let doc = registeredDoc();
    doc = acceptPairingInvitation(sendPairingInvitation(doc, "u-m1", "u-f1"), "u-f1", "u-m1");
    expect(capture(() => sendPairingInvitation(doc, "u-m1", "u-f2")).code).toBe("pairing-unavailable");
    expect(capture(() => sendPairingInvitation(doc, "u-m2", "u-f1")).code).toBe("pairing-unavailable");

    const second = sendPairingInvitation(doc, "u-m2", "u-f2");
    const acceptedSecond = acceptPairingInvitation(second, "u-f2", "u-m2");
    expect(acceptedSecond.teams).toHaveLength(2);
    expect(capture(() => acceptPairingInvitation(acceptedSecond, "u-f2", "u-m2")).code).toBe("pairing-invalid");
  });

  it("declines without creating a team and allows a fresh invitation", () => {
    const doc = registeredDoc();
    const invited = sendPairingInvitation(doc, "u-m1", "u-f1");
    const declined = declinePairingInvitation(invited, "u-f1", "u-m1");
    expect(declined.teams).toHaveLength(0);
    expect(declined.pairingInvitations?.["u-m1"].status).toBe("declined");

    const fresh = sendPairingInvitation(declined, "u-m2", "u-f1");
    expect(fresh.pairingInvitations?.["u-m2"].status).toBe("pending");
    expect(validateTournamentIntegrity(fresh)).toEqual([]);
  });

  it("lets the inviter withdraw a pending invitation", () => {
    const invited = sendPairingInvitation(registeredDoc(), "u-m1", "u-f1");
    const cancelled = cancelPairingInvitation(invited, "u-m1");
    expect(cancelled.pairingInvitations?.["u-m1"].status).toBe("cancelled");
    expect(cancelled.teams).toHaveLength(0);
    expect(selectAvailablePlayers(cancelled, "u-m1").map((p) => p.uid)).toContain("u-f1");
  });

  it("supports admin create, change and removal of pairings", () => {
    let doc = adminCreatePairTeam(registeredDoc(), "u-m1", "u-f1", ADMIN);
    const firstId = createPairTeamId("u-m1", "u-f1");
    expect(doc.teams[0].id).toBe(firstId);
    expect(doc.teams[0].status).toBe("pending");
    expect(getRegisteredTeamId(doc, "u-m1")).toBe(firstId);

    doc = adminChangePairing(doc, firstId, "u-m2", "u-f1", ADMIN);
    const changedId = createPairTeamId("u-m2", "u-f1");
    expect(doc.teams[0]).toMatchObject({
      id: firstId,
      playerIds: ["u-m2", "u-f1"],
      name: "Noah Wilson / Sofia Brown",
      status: "pending",
    });
    expect(getRegisteredTeamId(doc, "u-m1")).toBeNull();
    expect(getRegisteredTeamId(doc, "u-m2")).toBe(firstId);
    expect(doc.pairingInvitations?.[changedId]).toBeUndefined();
    expect(validateTournamentIntegrity(doc)).toEqual([]);

    doc = adminRemovePairing(doc, firstId, ADMIN);
    expect(doc.teams).toHaveLength(0);
    expect(getRegisteredTeamId(doc, "u-m2")).toBeNull();
    expect(getRegisteredTeamId(doc, "u-f1")).toBeNull();
    expect(selectUnpairedPlayers(doc)).toHaveLength(4);
    expect(validateTournamentIntegrity(doc)).toEqual([]);
  });

  it("locks pairings once the tournament moves past configuration", () => {
    const base = registeredDoc();
    const locked: GsdeTournamentDocument = {
      ...base,
      tournament: { ...base.tournament, status: "group-stage" },
    };
    expect(isPairingLocked(locked)).toBe(true);
    expect(selectAvailablePlayers(locked, "u-m1")).toEqual([]);
    expect(capture(() => sendPairingInvitation(locked, "u-m1", "u-f1")).code).toBe(
      "registration-closed"
    );
  });

  it("round-trips invitations through Firestore and defaults them for legacy documents", () => {
    const accepted = acceptPairingInvitation(
      sendPairingInvitation(registeredDoc(), "u-m1", "u-f1"),
      "u-f1",
      "u-m1"
    );
    const restored = fromGsdeFirestoreData(toGsdeFirestoreData(accepted), accepted.id);
    expect(restored?.pairingInvitations).toEqual(accepted.pairingInvitations);
    expect(restored?.pairingResponses).toEqual(accepted.pairingResponses);

    const { pairingInvitations, pairingResponses, ...legacy } = toGsdeFirestoreData(accepted);
    const legacyRestored = fromGsdeFirestoreData(legacy, accepted.id);
    expect(legacyRestored?.pairingInvitations).toEqual({});
    expect(legacyRestored?.pairingResponses).toEqual({});
  });
});
