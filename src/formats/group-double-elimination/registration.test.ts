import { describe, expect, it } from "vitest";
import type { PlayerGender, TournamentCategory } from "./types";
import {
  createGsdeTournamentDocument,
  fromGsdeFirestoreData,
  toGsdeFirestoreData,
  type GsdeTournamentDocument,
} from "./persistence";
import {
  findRegistrationByEmail,
  findRegistrationByUid,
  getRegisteredTeamId,
  getRegistrationStats,
  getRegistrations,
  isApprovedUnpairedPlayer,
  normalizeRegistrationEmail,
  selectApprovedUnpairedRegistrations,
  selectPendingRegistrations,
  selectRegistrationsByStatus,
  validateRegistrationDraft,
} from "./registration";
import {
  approvePlayerRegistration,
  editPlayerRegistration,
  registerPlayer,
  rejectPlayerRegistration,
  removePlayerRegistration,
  ScoringError,
} from "./scoring";
import { adminCreatePairTeam, createPairTeamId } from "./pairing";
import { validateTournamentIntegrity } from "./integrity";

const ADMIN = { id: "admin-1", label: "admin@example.com", isAdmin: true };

const draft = (
  uid: string,
  email: string,
  name: string,
  gender: PlayerGender = "male"
) => ({ uid, email, name, gender });

const makeDoc = (
  category: TournamentCategory = "Mixto"
): GsdeTournamentDocument => {
  const base = createGsdeTournamentDocument("event-1");
  return {
    ...base,
    tournament: {
      ...base.tournament,
      config: { ...base.tournament.config, category },
    },
  };
};

const playerA = draft("u1", "alex@example.com", "Alex", "male");
const playerB = draft("u2", "blair@example.com", "Blair", "female");

const capture = (action: () => unknown): ScoringError => {
  try {
    action();
  } catch (error) {
    if (error instanceof ScoringError) return error;
    throw error;
  }
  throw new Error("Expected a ScoringError");
};

describe("individual registration", () => {
  it("normalizes emails and validates player-supplied fields", () => {
    expect(normalizeRegistrationEmail("  Alex@Example.COM ")).toBe("alex@example.com");
    expect(validateRegistrationDraft(draft("u1", "a@b.com", "Alex"))).toEqual([]);
    expect(validateRegistrationDraft(draft("", "a@b.com", "Alex")).map((i) => i.field)).toContain("uid");
    expect(validateRegistrationDraft(draft("u1", "not-an-email", "Alex")).map((i) => i.field)).toContain("email");
    expect(validateRegistrationDraft(draft("u1", "a@b.com", "A")).map((i) => i.field)).toContain("name");
    expect(
      validateRegistrationDraft({
        ...draft("u1", "a@b.com", "Alex"),
        gender: "" as PlayerGender,
      }).map((i) => i.field)
    ).toContain("gender");
  });

  it("registers one pending individual with no partner, team name or team link", () => {
    const doc = registerPlayer(makeDoc(), draft("u1", "  Alex@Example.com ", "  Alex  "));

    expect(getRegistrations(doc)).toHaveLength(1);
    expect(getRegistrations(doc)[0]).toMatchObject({
      uid: "u1",
      email: "alex@example.com",
      name: "Alex",
      gender: "male",
      status: "pending",
      teamId: null,
      decidedAt: null,
    });
    expect(doc.teams).toEqual([]);
    expect(getRegisteredTeamId(doc, "u1")).toBeNull();
    expect(doc.auditLog?.some((entry) => entry.action === "player-registered")).toBe(true);
    expect(validateTournamentIntegrity(doc)).toEqual([]);
  });

  it("rejects duplicate uid/email registrations and invalid fields without mutating", () => {
    const doc = registerPlayer(makeDoc(), draft("u1", "alex@example.com", "Alex"));
    expect(capture(() => registerPlayer(doc, draft("u1", "other@example.com", "Other"))).code).toBe("already-registered");
    expect(capture(() => registerPlayer(doc, draft("u2", "ALEX@example.com", "Other"))).code).toBe("already-registered");
    expect(capture(() => registerPlayer(doc, draft("", "x@y.com", "X"))).code).toBe("registration-invalid");
    expect(getRegistrations(doc)).toHaveLength(1);
  });
});

describe("independent admin approval", () => {
  it("approves an individual without creating or assigning a team", () => {
    const registered = registerPlayer(makeDoc(), playerA);
    const approved = approvePlayerRegistration(registered, "u1", ADMIN);

    expect(findRegistrationByUid(approved, "u1")).toMatchObject({
      status: "approved",
      teamId: null,
    });
    expect(findRegistrationByUid(approved, "u1")?.decidedAt).toBeTruthy();
    expect(approved.teams).toEqual([]);
    expect(isApprovedUnpairedPlayer(approved, "u1")).toBe(true);
    expect(selectApprovedUnpairedRegistrations(approved).map((item) => item.uid)).toEqual(["u1"]);
    expect(approved.playerPairingIndex?.["u1"]).toEqual({ status: "approved", teamId: null });
    expect(approved.auditLog?.some((entry) => entry.action === "player-registration-approved")).toBe(true);
    expect(validateTournamentIntegrity(approved)).toEqual([]);
  });

  it("reports separate pending, approved, rejected and unpaired counts", () => {
    let doc = makeDoc();
    doc = registerPlayer(doc, playerA);
    doc = registerPlayer(doc, playerB);
    doc = registerPlayer(doc, draft("u3", "casey@example.com", "Casey", "male"));
    doc = approvePlayerRegistration(doc, "u1", ADMIN);
    doc = rejectPlayerRegistration(doc, "u2", ADMIN);

    expect(getRegistrationStats(doc)).toMatchObject({
      total: 3,
      pending: 1,
      approved: 1,
      rejected: 1,
      assigned: 0,
      approvedUnpaired: 1,
    });
    expect(selectPendingRegistrations(doc).map((item) => item.uid)).toEqual(["u3"]);
    expect(selectRegistrationsByStatus(doc, "approved").map((item) => item.uid)).toEqual(["u1"]);
    expect(selectRegistrationsByStatus(doc, "rejected").map((item) => item.uid)).toEqual(["u2"]);
    expect(findRegistrationByEmail(doc, " ALEX@EXAMPLE.COM ")?.uid).toBe("u1");
  });

  it("edits player details without changing approval or team state", () => {
    let doc = registerPlayer(makeDoc(), playerA);
    doc = approvePlayerRegistration(doc, "u1", ADMIN);
    doc = editPlayerRegistration(
      doc,
      "u1",
      { name: "Alex Updated", email: " NEW@EXAMPLE.COM ", gender: "female" },
      ADMIN
    );

    expect(findRegistrationByUid(doc, "u1")).toMatchObject({
      name: "Alex Updated",
      email: "new@example.com",
      gender: "female",
      status: "approved",
      teamId: null,
    });
    expect(doc.auditLog?.some((entry) => entry.action === "player-registration-edited")).toBe(true);
    expect(validateTournamentIntegrity(doc)).toEqual([]);
  });

  it("rejects duplicate email edits and approval of unknown registrations", () => {
    let doc = registerPlayer(makeDoc(), playerA);
    doc = registerPlayer(doc, playerB);

    expect(capture(() => editPlayerRegistration(doc, "u1", { email: "blair@example.com" }, ADMIN)).code).toBe(
      "already-registered"
    );
    expect(capture(() => approvePlayerRegistration(doc, "missing", ADMIN)).code).toBe("registration-not-found");
    expect(capture(() => rejectPlayerRegistration(doc, "missing", ADMIN)).code).toBe("registration-not-found");
    expect(capture(() => removePlayerRegistration(doc, "missing", ADMIN)).code).toBe("registration-not-found");
  });

  it("refuses approval when a legacy registration has no gender", () => {
    let doc = registerPlayer(makeDoc(), playerA);
    doc = {
      ...doc,
      registrations: getRegistrations(doc).map(({ gender: _gender, ...rest }) => rest),
    };
    expect(capture(() => approvePlayerRegistration(doc, "u1", ADMIN)).code).toBe("registration-invalid");
  });

  it("closes approval, editing and decisions once the group stage starts", () => {
    const base = registerPlayer(makeDoc(), playerA);
    const locked: GsdeTournamentDocument = {
      ...base,
      tournament: { ...base.tournament, status: "group-stage" },
    };
    expect(capture(() => registerPlayer(locked, playerB)).code).toBe("registration-closed");
    expect(capture(() => approvePlayerRegistration(locked, "u1", ADMIN)).code).toBe("registration-closed");
    expect(capture(() => editPlayerRegistration(locked, "u1", { name: "Other" }, ADMIN)).code).toBe("registration-closed");
    expect(capture(() => rejectPlayerRegistration(locked, "u1", ADMIN)).code).toBe("registration-closed");
    expect(capture(() => removePlayerRegistration(locked, "u1", ADMIN)).code).toBe("registration-closed");
  });
});

describe("team changes preserve player approval", () => {
  const approvedPairDoc = (): GsdeTournamentDocument => {
    let doc = registerPlayer(makeDoc(), playerA);
    doc = registerPlayer(doc, playerB);
    doc = approvePlayerRegistration(doc, "u1", ADMIN);
    doc = approvePlayerRegistration(doc, "u2", ADMIN);
    return adminCreatePairTeam(doc, "u1", "u2", ADMIN);
  };

  it("links approved players to a confirmed team without re-approving them", () => {
    const doc = approvedPairDoc();
    const teamId = createPairTeamId("u1", "u2");

    expect(doc.teams).toHaveLength(1);
    expect(doc.teams[0]).toMatchObject({
      id: teamId,
      name: "Alex / Blair",
      playerIds: ["u1", "u2"],
      status: "confirmed",
      groupId: null,
    });
    expect(getRegisteredTeamId(doc, "u1")).toBe(teamId);
    expect(getRegisteredTeamId(doc, "u2")).toBe(teamId);
    expect(findRegistrationByUid(doc, "u1")?.status).toBe("approved");
    expect(findRegistrationByUid(doc, "u2")?.status).toBe("approved");
    expect(doc.playerPairingIndex?.["u1"]).toEqual({ status: "approved", teamId });
    expect(doc.playerPairingIndex?.["u2"]).toEqual({ status: "approved", teamId });
    expect(validateTournamentIntegrity(doc)).toEqual([]);
  });

  it("rejecting a paired player dissolves the team and keeps the other player approved", () => {
    const doc = rejectPlayerRegistration(approvedPairDoc(), "u1", ADMIN);

    expect(doc.teams).toEqual([]);
    expect(findRegistrationByUid(doc, "u1")?.status).toBe("rejected");
    expect(findRegistrationByUid(doc, "u1")?.teamId).toBeNull();
    expect(findRegistrationByUid(doc, "u2")?.status).toBe("approved");
    expect(findRegistrationByUid(doc, "u2")?.teamId).toBeNull();
    expect(isApprovedUnpairedPlayer(doc, "u2")).toBe(true);
    expect(validateTournamentIntegrity(doc)).toEqual([]);
  });

  it("removing a paired player dissolves the team and keeps the other player approved", () => {
    const doc = removePlayerRegistration(approvedPairDoc(), "u1", ADMIN);

    expect(doc.teams).toEqual([]);
    expect(findRegistrationByUid(doc, "u1")).toBeUndefined();
    expect(findRegistrationByUid(doc, "u2")?.status).toBe("approved");
    expect(getRegisteredTeamId(doc, "u2")).toBeNull();
    expect(validateTournamentIntegrity(doc)).toEqual([]);
  });
});

describe("registration integrity and persistence", () => {
  it("flags duplicate identities, invalid assignments and a stale pairing index", () => {
    const base = registerPlayer(makeDoc(), playerA);
    const duplicateUid = {
      ...base,
      registrations: [
        ...getRegistrations(base),
        { ...getRegistrations(base)[0], email: "other@example.com" },
      ],
    };
    expect(validateTournamentIntegrity(duplicateUid).map((issue) => issue.code)).toContain("duplicate-registration-uid");

    const duplicateEmail = {
      ...base,
      registrations: [
        ...getRegistrations(base),
        {
          uid: "u2",
          email: " ALEX@EXAMPLE.COM ",
          name: "Other",
          gender: "female" as const,
          status: "pending" as const,
          teamId: null,
          registeredAt: "2026-01-01T00:00:00.000Z",
          decidedAt: null,
        },
      ],
    };
    expect(validateTournamentIntegrity(duplicateEmail).map((issue) => issue.code)).toContain("duplicate-registration-email");

    const invalidTeam = {
      ...base,
      registrations: getRegistrations(base).map((item) => ({ ...item, status: "approved" as const, teamId: "missing" })),
    };
    expect(validateTournamentIntegrity(invalidTeam).map((issue) => issue.code)).toContain("invalid-registration-team");

    const staleIndex = {
      ...base,
      registrations: getRegistrations(base).map((item) => ({ ...item, status: "approved" as const })),
    };
    expect(validateTournamentIntegrity(staleIndex).map((issue) => issue.code)).toContain("invalid-player-pairing-index");
  });

  it("round-trips registrations and rebuilds the derived index through Firestore serialization", () => {
    let doc = registerPlayer(makeDoc(), playerA);
    doc = approvePlayerRegistration(doc, "u1", ADMIN);
    doc = registerPlayer(doc, playerB);

    const restored = fromGsdeFirestoreData(toGsdeFirestoreData(doc), doc.id);
    expect(restored).toEqual(doc);
    expect(getRegistrations(restored!)).toEqual(getRegistrations(doc));
    expect(restored?.playerPairingIndex).toEqual(doc.playerPairingIndex);
  });
});
