import { describe, expect, it } from "vitest";
import type { AuditActor } from "./audit";
import {
  categoryForGenders,
  isPairValidForCategory,
} from "./category";
import {
  createGsdeTournamentDocument,
  toGsdeFirestoreData,
  type GsdeTournamentDocument,
} from "./persistence";
import { getRegisteredTeamId } from "./registration";
import { startGroupStage } from "./scoring";
import {
  buildTestPairs,
  canLoadTestData,
  GROUP_COUNT_BY_TEAM_COUNT,
  loadTestTeamsAndPlayers,
  SUPPORTED_TEST_TEAM_COUNTS,
  testPlayerEmail,
  testPlayerUid,
  type TestTeamCount,
} from "./testData";
import type { TournamentCategory } from "./types";

const ADMIN: AuditActor = {
  id: "admin-1",
  label: "admin@kingqueen.test",
  isAdmin: true,
};

const makeDoc = (
  teamLimit: TestTeamCount = 16,
  category: TournamentCategory = "Mixto"
): GsdeTournamentDocument => {
  const template = createGsdeTournamentDocument("test1");
  return {
    ...template,
    tournament: {
      ...template.tournament,
      config: {
        ...template.tournament.config,
        teamLimit,
        category,
        groupCount: GROUP_COUNT_BY_TEAM_COUNT[teamLimit],
        teamsPerGroup: 4,
      },
    },
  };
};

describe("GSDE admin test-data loader", () => {
  it("creates 16 approved pairs, 32 players and the full 24-match schedule", () => {
    const loaded = loadTestTeamsAndPlayers(makeDoc(), ADMIN);

    expect(loaded.teams).toHaveLength(16);
    expect(loaded.teams.every((team) => team.status === "approved")).toBe(true);
    expect(loaded.registrations).toHaveLength(32);
    expect(loaded.groups).toHaveLength(4);
    expect(loaded.matches).toHaveLength(24);
    expect(loaded.elimination).toBeNull();
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

  it.each(SUPPORTED_TEST_TEAM_COUNTS)(
    "creates exactly %i fixed pairs and %i players",
    (teamCount) => {
      const loaded = loadTestTeamsAndPlayers(makeDoc(teamCount), ADMIN);
      const groupCount = GROUP_COUNT_BY_TEAM_COUNT[teamCount];

      expect(loaded.teams).toHaveLength(teamCount);
      expect(loaded.registrations).toHaveLength(teamCount * 2);
      expect(loaded.groups).toHaveLength(groupCount);
      expect(loaded.matches).toHaveLength(groupCount * 6);
      expect(
        loaded.teams.every(
          (team) =>
            team.playerIds.length === 2 &&
            team.playerIds[0] !== team.playerIds[1] &&
            team.name.includes(" / ")
        )
      ).toBe(true);
      expect(
        loaded.teams.every((team) =>
          team.playerIds.every((uid) =>
            loaded.registrations?.some(
              (registration) => registration.uid === uid && registration.teamId === team.id
            )
          )
        )
      ).toBe(true);
    }
  );

  it("derives default team names from both players and keeps pairs together", () => {
    const loaded = loadTestTeamsAndPlayers(makeDoc(8, "Mixto"), ADMIN);
    const before = loaded.teams.map((team) => [...team.playerIds]);

    expect(loaded.teams[0].name).toBe(
      `${loaded.registrations?.[0].name} / ${loaded.registrations?.[1].name}`
    );
    expect(loaded.teams[0].nameIsCustom).toBe(false);
    expect(loaded.teams.map((team) => [...team.playerIds])).toEqual(before);
  });

  it.each([
    ["Male", "male", "male"] as const,
    ["Female", "female", "female"] as const,
    ["Mixto", "male", "female"] as const,
  ])("respects the %s category when generating pairs", (category, first, second) => {
    const pairs = buildTestPairs(12, category);

    expect(pairs).toHaveLength(12);
    expect(pairs.every((pair) => pair.players[0].gender === first)).toBe(true);
    expect(pairs.every((pair) => pair.players[1].gender === second)).toBe(true);

    const loaded = loadTestTeamsAndPlayers(makeDoc(12, category), ADMIN);
    expect(
      loaded.teams.every((team) => {
        const genders = team.playerIds.map(
          (uid) => loaded.registrations?.find((item) => item.uid === uid)?.gender
        );
        return isPairValidForCategory(category, genders as ["male" | "female", "male" | "female"]);
      })
    ).toBe(true);
  });

  it("generates equal male and female player counts for Mixto", () => {
    const pairs = buildTestPairs(32, "Mixto");
    const genders = pairs.flatMap((pair) => pair.players.map((player) => player.gender));

    expect(genders).toHaveLength(64);
    expect(genders.filter((gender) => gender === "male")).toHaveLength(32);
    expect(genders.filter((gender) => gender === "female")).toHaveLength(32);
  });

  it("exposes pure category pair validation", () => {
    expect(categoryForGenders(["male", "male"])).toBe("Male");
    expect(categoryForGenders(["female", "female"])).toBe("Female");
    expect(categoryForGenders(["male", "female"])).toBe("Mixto");
    expect(isPairValidForCategory("Mixto", ["male", "male"])).toBe(false);
    expect(isPairValidForCategory("Female", ["female", "female"])).toBe(true);
  });

  it("refuses to overwrite a tournament that has already started", () => {
    const loaded = loadTestTeamsAndPlayers(makeDoc(), ADMIN);
    const started = startGroupStage(loaded, ADMIN);

    expect(canLoadTestData(started)).toBe(false);
    expect(() => loadTestTeamsAndPlayers(started, ADMIN)).toThrow();
  });

  it("only produces fields that serialize into tournaments/{id}", () => {
    const loaded = loadTestTeamsAndPlayers(makeDoc(), ADMIN);
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
