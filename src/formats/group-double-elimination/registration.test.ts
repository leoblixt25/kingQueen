import { describe, expect, it } from "vitest";
import type { PlayerGender, Team, TournamentCategory } from "./types";
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
  normalizeRegistrationEmail,
  selectPendingRegistrations,
  validateRegistrationDraft,
} from "./registration";
import {
  approvePlayerRegistration,
  registerPlayer,
  rejectPlayerRegistration,
  removePlayerRegistration,
  ScoringError,
} from "./scoring";
import { validateTournamentIntegrity } from "./integrity";

const ADMIN = { id: "admin-1", label: "admin@example.com", isAdmin: true };

const makeTeams = (customName = false): Team[] => [
  {
    id: "t1",
    name: customName ? "The Spikers" : "Team 1",
    playerIds: [],
    seed: 1,
    groupId: null,
    ...(customName ? { nameIsCustom: true } : {}),
  },
  { id: "t2", name: "Team 2", playerIds: [], seed: 2, groupId: null },
];

const makeDoc = (
  category: TournamentCategory = "Mixto",
  teams: Team[] = makeTeams()
): GsdeTournamentDocument => {
  const template = createGsdeTournamentDocument("event-1", { teams });
  return {
    ...template,
    tournament: {
      ...template.tournament,
      config: { ...template.tournament.config, category },
    },
  };
};

const draft = (
  uid: string,
  email: string,
  name: string,
  gender: PlayerGender = "male"
) => ({ uid, email, name, gender });

const capture = (action: () => unknown): ScoringError => {
  try {
    action();
  } catch (error) {
    if (error instanceof ScoringError) return error;
    throw error;
  }
  throw new Error("Expected a ScoringError");
};

describe("player registration validation and selectors", () => {
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

  it("resolves a team only for an approved, assigned registration", () => {
    let doc = registerPlayer(makeDoc(), draft("u1", "a@b.com", "Alex"));
    expect(getRegisteredTeamId(doc, "u1")).toBeNull();

    doc = approvePlayerRegistration(doc, "u1", "t1", ADMIN);
    expect(getRegisteredTeamId(doc, "u1")).toBe("t1");

    doc = rejectPlayerRegistration(doc, "u1", ADMIN);
    expect(getRegisteredTeamId(doc, "u1")).toBeNull();
  });

  it("reports registration stats and orders pending registrations by time", () => {
    let doc = makeDoc();
    doc = registerPlayer(doc, draft("u1", "a@b.com", "Alex"));
    // Force distinct, sortable timestamps without relying on clock resolution.
    const registrations = getRegistrations(doc).map((item, index) => ({
      ...item,
      registeredAt: index === 0 ? "2026-01-02T00:00:00.000Z" : item.registeredAt,
    }));
    doc = { ...doc, registrations };
    doc = registerPlayer(doc, draft("u2", "b@b.com", "Blair", "female"));
    doc = {
      ...doc,
      registrations: getRegistrations(doc).map((item) =>
        item.uid === "u2" ? { ...item, registeredAt: "2026-01-01T00:00:00.000Z" } : item
      ),
    };
    doc = approvePlayerRegistration(doc, "u2", "t2", ADMIN);

    const stats = getRegistrationStats(doc);
    expect(stats).toMatchObject({ total: 2, pending: 1, approved: 1, assigned: 1 });
    expect(selectPendingRegistrations(doc).map((item) => item.uid)).toEqual(["u1"]);
    expect(findRegistrationByUid(doc, "u1")?.email).toBe("a@b.com");
    expect(findRegistrationByEmail(doc, " A@B.COM ")?.uid).toBe("u1");
  });
});

describe("registration mutations", () => {
  it("registers a pending player, normalized, with gender and an audit entry", () => {
    const doc = registerPlayer(
      makeDoc(),
      draft("u1", "  Alex@Example.com ", "  Alex  "),
      { id: "u1", label: "alex@example.com", isAdmin: false }
    );

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
    expect(doc.auditLog?.some((entry) => entry.action === "player-registered")).toBe(true);
    expect(doc.teams.every((team) => team.playerIds.length === 0)).toBe(true);
  });

  it("rejects duplicate uid/email registrations and invalid fields", () => {
    const doc = registerPlayer(makeDoc(), draft("u1", "alex@example.com", "Alex"));
    expect(capture(() => registerPlayer(doc, draft("u1", "other@example.com", "Other"))).code).toBe("already-registered");
    expect(capture(() => registerPlayer(doc, draft("u2", "ALEX@example.com", "Other"))).code).toBe("already-registered");
    expect(capture(() => registerPlayer(doc, draft("", "x@y.com", "X"))).code).toBe("registration-invalid");
    expect(getRegistrations(doc)).toHaveLength(1); // failed attempts leave the doc unchanged
  });

  it("closes registration once the group stage starts", () => {
    const template = createGsdeTournamentDocument("event-1");
    const doc: GsdeTournamentDocument = {
      ...template,
      teams: makeTeams(),
      tournament: { ...template.tournament, status: "group-stage" },
    };
    expect(capture(() => registerPlayer(doc, draft("u1", "a@b.com", "Alex"))).code).toBe("registration-closed");
    expect(capture(() => approvePlayerRegistration(doc, "u1", "t1", ADMIN)).code).toBe("registration-closed");
    expect(capture(() => rejectPlayerRegistration(doc, "u1", ADMIN)).code).toBe("registration-closed");
    expect(capture(() => removePlayerRegistration(doc, "u1", ADMIN)).code).toBe("registration-closed");
  });

  it("approves a player, assigns a team, fills playerIds and audits the decision", () => {
    let doc = registerPlayer(makeDoc(), draft("u1", "a@b.com", "Alex"));
    doc = approvePlayerRegistration(doc, "u1", "t2", ADMIN);

    expect(findRegistrationByUid(doc, "u1")).toMatchObject({
      status: "approved",
      teamId: "t2",
    });
    expect(findRegistrationByUid(doc, "u1")?.decidedAt).toBeTruthy();
    expect(doc.teams.find((team) => team.id === "t2")?.playerIds).toEqual(["u1"]);
    expect(doc.teams.find((team) => team.id === "t1")?.playerIds).toEqual([]);
    expect(doc.auditLog?.some((entry) => entry.action === "player-registration-approved" && entry.teamId === "t2")).toBe(true);
  });

  it("reassigning an approved player moves the playerId to the new team", () => {
    let doc = registerPlayer(makeDoc(), draft("u1", "a@b.com", "Alex"));
    doc = approvePlayerRegistration(doc, "u1", "t1", ADMIN);
    doc = approvePlayerRegistration(doc, "u1", "t2", ADMIN);

    expect(doc.teams.find((team) => team.id === "t1")?.playerIds).toEqual([]);
    expect(doc.teams.find((team) => team.id === "t2")?.playerIds).toEqual(["u1"]);
  });

  it("refuses a third player on a fixed two-player team", () => {
    let doc = makeDoc();
    doc = registerPlayer(doc, draft("u1", "a@b.com", "Alex", "male"));
    doc = registerPlayer(doc, draft("u2", "b@b.com", "Blair", "female"));
    doc = registerPlayer(doc, draft("u3", "c@b.com", "Casey", "male"));
    doc = approvePlayerRegistration(doc, "u1", "t1", ADMIN);
    doc = approvePlayerRegistration(doc, "u2", "t1", ADMIN);

    expect(capture(() => approvePlayerRegistration(doc, "u3", "t1", ADMIN)).code).toBe(
      "invalid-team"
    );
  });

  it("refuses a pair that violates the selected category", () => {
    let doc = makeDoc("Male");
    doc = registerPlayer(doc, draft("u1", "a@b.com", "Alex", "male"));
    doc = registerPlayer(doc, draft("u2", "b@b.com", "Blair", "female"));
    doc = approvePlayerRegistration(doc, "u1", "t1", ADMIN);

    expect(capture(() => approvePlayerRegistration(doc, "u2", "t1", ADMIN)).code).toBe(
      "integrity-violation"
    );
  });

  it("refuses approval when a legacy registration has no gender", () => {
    let doc = registerPlayer(makeDoc(), draft("u1", "a@b.com", "Alex"));
    doc = {
      ...doc,
      registrations: getRegistrations(doc).map(({ gender: _gender, ...rest }) => rest),
    };
    expect(capture(() => approvePlayerRegistration(doc, "u1", "t1", ADMIN)).code).toBe(
      "registration-invalid"
    );
  });

  it("refreshes pair-derived team names but preserves custom names", () => {
    let derived = makeDoc();
    derived = registerPlayer(derived, draft("u1", "a@b.com", "Alex", "male"));
    derived = registerPlayer(derived, draft("u2", "b@b.com", "Blair", "female"));
    derived = approvePlayerRegistration(derived, "u1", "t1", ADMIN);
    derived = approvePlayerRegistration(derived, "u2", "t1", ADMIN);
    expect(derived.teams.find((team) => team.id === "t1")?.name).toBe("Alex / Blair");

    let custom = makeDoc("Mixto", makeTeams(true));
    custom = registerPlayer(custom, draft("u1", "a@b.com", "Alex", "male"));
    custom = registerPlayer(custom, draft("u2", "b@b.com", "Blair", "female"));
    custom = approvePlayerRegistration(custom, "u1", "t1", ADMIN);
    custom = approvePlayerRegistration(custom, "u2", "t1", ADMIN);
    expect(custom.teams.find((team) => team.id === "t1")?.name).toBe("The Spikers");
  });

  it("rejecting and removing a player clear the team assignment", () => {
    let doc = registerPlayer(makeDoc(), draft("u1", "a@b.com", "Alex"));
    doc = approvePlayerRegistration(doc, "u1", "t1", ADMIN);

    doc = rejectPlayerRegistration(doc, "u1", ADMIN);
    expect(findRegistrationByUid(doc, "u1")?.status).toBe("rejected");
    expect(findRegistrationByUid(doc, "u1")?.teamId).toBeNull();
    expect(doc.teams.every((team) => team.playerIds.length === 0)).toBe(true);
    expect(doc.auditLog?.some((entry) => entry.action === "player-registration-rejected")).toBe(true);

    doc = removePlayerRegistration(doc, "u1", ADMIN);
    expect(getRegistrations(doc)).toHaveLength(0);
    expect(findRegistrationByUid(doc, "u1")).toBeUndefined();
    expect(doc.auditLog?.some((entry) => entry.action === "player-registration-removed")).toBe(true);
  });

  it("rejects approval for an unknown registration or unknown team", () => {
    const doc = registerPlayer(makeDoc(), draft("u1", "a@b.com", "Alex"));
    expect(capture(() => approvePlayerRegistration(doc, "missing", "t1", ADMIN)).code).toBe("registration-not-found");
    expect(capture(() => approvePlayerRegistration(doc, "u1", "missing", ADMIN)).code).toBe("invalid-team");
  });
});

describe("registration integrity and persistence", () => {
  it("flags duplicate registration identities and invalid assignments", () => {
    const base = registerPlayer(makeDoc(), draft("u1", "a@b.com", "Alex"));
    const duplicateUid = {
      ...base,
      registrations: [
        ...getRegistrations(base),
        { ...getRegistrations(base)[0], email: "other@b.com" },
      ],
    };
    expect(validateTournamentIntegrity(duplicateUid).map((issue) => issue.code)).toContain("duplicate-registration-uid");

    const duplicateEmail = {
      ...base,
      registrations: [
        ...getRegistrations(base),
        { uid: "u2", email: " A@B.COM ", name: "Other", gender: "female" as const, status: "pending" as const, teamId: null, registeredAt: "2026-01-01T00:00:00.000Z", decidedAt: null },
      ],
    };
    expect(validateTournamentIntegrity(duplicateEmail).map((issue) => issue.code)).toContain("duplicate-registration-email");

    const invalidTeam = {
      ...base,
      registrations: getRegistrations(base).map((item) => ({ ...item, status: "approved" as const, teamId: "missing" })),
    };
    expect(validateTournamentIntegrity(invalidTeam).map((issue) => issue.code)).toContain("invalid-registration-team");
  });

  it("round-trips registrations through Firestore serialization", () => {
    let doc = makeDoc();
    doc = registerPlayer(doc, draft("u1", "a@b.com", "Alex"));
    doc = approvePlayerRegistration(doc, "u1", "t1", ADMIN);

    const restored = fromGsdeFirestoreData(toGsdeFirestoreData(doc), doc.id);
    expect(restored).toEqual(doc);
    expect(getRegistrations(restored!)).toEqual(getRegistrations(doc));
  });
});
