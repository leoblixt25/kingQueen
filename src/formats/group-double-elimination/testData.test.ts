import { describe, expect, it } from "vitest";
import type { AuditActor } from "./audit";
import { createGsdeTournamentDocument, toGsdeFirestoreData } from "./persistence";
import { getRegisteredTeamId } from "./registration";
import { startGroupStage } from "./scoring";
import {
  canLoadTestData,
  loadTestTeamsAndPlayers,
  testPlayerEmail,
  testPlayerUid,
} from "./testData";

const ADMIN: AuditActor = {
  id: "admin-1",
  label: "admin@kingqueen.test",
  isAdmin: true,
};

describe("GSDE admin test-data loader", () => {
  it("creates 16 approved teams, players and the full 24-match schedule", () => {
    const loaded = loadTestTeamsAndPlayers(
      createGsdeTournamentDocument("test1"),
      ADMIN
    );

    expect(loaded.teams).toHaveLength(16);
    expect(loaded.teams.every((team) => team.status === "approved")).toBe(true);
    expect(loaded.groups).toHaveLength(4);
    expect(loaded.matches).toHaveLength(24);
    expect(loaded.elimination).toBeNull();
    expect(loaded.registrations).toHaveLength(16);
    expect(
      loaded.registrations?.every(
        (registration) =>
          registration.status === "approved" && Boolean(registration.teamId)
      )
    ).toBe(true);
    expect(loaded.registrations?.[0].email).toBe(testPlayerEmail(0));
    expect(loaded.teams[0].playerIds).toContain(testPlayerUid(0));
    expect(getRegisteredTeamId(loaded, testPlayerUid(0))).toBe(loaded.teams[0].id);
    expect(loaded.auditLog?.some((entry) => entry.action === "test-data-loaded")).toBe(
      true
    );
  });

  it("refuses to overwrite a tournament that has already started", () => {
    const loaded = loadTestTeamsAndPlayers(
      createGsdeTournamentDocument("test1"),
      ADMIN
    );
    const started = startGroupStage(loaded, ADMIN);

    expect(canLoadTestData(started)).toBe(false);
    expect(() => loadTestTeamsAndPlayers(started, ADMIN)).toThrow();
  });

  it("only produces fields that serialize into tournaments/{id}", () => {
    const loaded = loadTestTeamsAndPlayers(
      createGsdeTournamentDocument("test1"),
      ADMIN
    );
    const data = toGsdeFirestoreData(loaded);

    expect(Object.keys(data).sort()).toEqual(
      [
        "auditLog",
        "elimination",
        "formatId",
        "groups",
        "matches",
        "registrations",
        "scoreSubmissions",
        "settings",
        "teams",
        "tournament",
      ].sort()
    );
    expect(data.formatId).toBe("group-double-elimination");
  });
});
