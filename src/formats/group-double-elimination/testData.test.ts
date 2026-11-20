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
import { listEliminationMatches } from "./bracket";
import { selectFinalResult, startGroupStage } from "./scoring";
import {
  buildTestPairs,
  canLoadDemoTestData,
  canLoadTestData,
  DEMO_PLAYER_EMAIL,
  DEMO_PLAYER_NAME,
  ensureDemoPlayerTestData,
  findDemoRegistration,
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

/** Small deterministic LCG so simulated outcomes are repeatable in tests. */
const seededRng = (seed: number): (() => number) => {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
};

const expectWinnerOn21 = (match: {
  teamAId: string | null;
  teamBId: string | null;
  winnerId: string | null;
  scoreA: number | null;
  scoreB: number | null;
}): void => {
  expect(match.scoreA).not.toBeNull();
  expect(match.scoreB).not.toBeNull();
  const a = match.scoreA as number;
  const b = match.scoreB as number;
  const winnerScore = match.winnerId === match.teamAId ? a : b;
  const loserScore = match.winnerId === match.teamAId ? b : a;
  expect(winnerScore).toBe(21);
  expect(loserScore).toBeGreaterThanOrEqual(0);
  expect(loserScore).toBeLessThanOrEqual(20);
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
    expect(loaded.teams.every((team) => team.status === "confirmed")).toBe(true);
    expect(loaded.registrations).toHaveLength(32);
    expect(loaded.groups).toHaveLength(4);
    expect(loaded.matches).toHaveLength(24);
    expect(loaded.elimination).toBeNull();
    expect(
      loaded.registrations?.every(
        (registration) =>
          registration.status === "approved" &&
          Boolean(getRegisteredTeamId(loaded, registration.uid))
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
          team.playerIds.every((uid) => getRegisteredTeamId(loaded, uid) === team.id)
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
        "pairingInvitations",
        "pairingResponses",
        "playerPairingIndex",
        "registrations",
        "scoreSubmissions",
        "settings",
        "teams",
        "tournament",
      ].sort()
    );
    expect(data.formatId).toBe("group-double-elimination");
  });

  it("can fill random group scores with the winner on 21", () => {
    const loaded = loadTestTeamsAndPlayers(makeDoc(8), ADMIN, {
      results: "groups",
      rng: seededRng(7),
    });

    expect(loaded.tournament.status).toBe("group-stage");
    expect(loaded.matches).toHaveLength(12);
    expect(loaded.matches.every((match) => match.status === "completed")).toBe(true);
    loaded.matches.forEach(expectWinnerOn21);
    expect(loaded.elimination).toBeNull();
  });

  it.each(SUPPORTED_TEST_TEAM_COUNTS)(
    "simulates the full %i-team tournament through to a champion",
    (teamCount) => {
      const loaded = loadTestTeamsAndPlayers(makeDoc(teamCount), ADMIN, {
        results: "full",
        rng: seededRng(teamCount),
      });

      expect(loaded.tournament.status).toBe("completed");
      expect(loaded.elimination).not.toBeNull();
      expect(selectFinalResult(loaded)?.complete).toBe(true);

      const allMatches = [
        ...loaded.matches,
        ...listEliminationMatches(loaded.elimination!),
      ];
      expect(allMatches.every((match) => match.status === "completed")).toBe(true);
      allMatches.forEach(expectWinnerOn21);
      expect(
        loaded.auditLog?.some((entry) => entry.action === "test-data-loaded")
      ).toBe(true);
      expect(
        loaded.auditLog?.some((entry) => entry.action === "elimination-score-entered")
      ).toBe(true);
    }
  );

  const DEMO_ID = {
    uid: "real-firebase-demo-uid",
    email: DEMO_PLAYER_EMAIL,
    name: DEMO_PLAYER_NAME,
  };

  it("creates a real-auth demo participant with an approved paired team and an active schedule", () => {
    const loaded = loadTestTeamsAndPlayers(makeDoc(8, "Mixto"), ADMIN, {
      demo: DEMO_ID,
      rng: seededRng(11),
    });
    const demo = findDemoRegistration(loaded);

    expect(demo).toMatchObject({
      uid: DEMO_ID.uid,
      email: DEMO_PLAYER_EMAIL,
      name: DEMO_PLAYER_NAME,
      status: "approved",
    });

    const teamId = getRegisteredTeamId(loaded, DEMO_ID.uid);
    expect(teamId).not.toBeNull();
    const team = loaded.teams.find((item) => item.id === teamId);
    expect(team).toBeDefined();
    expect(team?.playerIds).toHaveLength(2);
    expect(team?.playerIds).toContain(DEMO_ID.uid);
    expect(team?.groupId).toBeTruthy();
    expect(loaded.groups.some((group) => group.id === team?.groupId)).toBe(true);
    expect(
      loaded.matches.some(
        (match) => match.teamAId === teamId || match.teamBId === teamId
      )
    ).toBe(true);
    expect(loaded.tournament.status).toBe("group-stage");
    expect(loaded.teams).toHaveLength(8);
    expect(loaded.registrations).toHaveLength(16);
    expect(
      loaded.registrations?.filter((item) => item.email === DEMO_PLAYER_EMAIL)
    ).toHaveLength(1);
    expect(loaded.playerPairingIndex?.[DEMO_ID.uid]).toEqual({
      status: "approved",
      teamId,
    });
  });

  it.each([
    ["Male", "male"] as const,
    ["Female", "female"] as const,
    ["Mixto", "male"] as const,
  ])("keeps the demo pair category-valid in %s", (category, demoGender) => {
    const loaded = loadTestTeamsAndPlayers(makeDoc(8, category), ADMIN, {
      demo: DEMO_ID,
    });
    const demo = findDemoRegistration(loaded);
    const teamId = getRegisteredTeamId(loaded, DEMO_ID.uid);
    const team = loaded.teams.find((item) => item.id === teamId);
    const partnerUid = team?.playerIds.find((uid) => uid !== DEMO_ID.uid);
    const partner = partnerUid
      ? loaded.registrations?.find((item) => item.uid === partnerUid)
      : undefined;

    expect(demo?.gender).toBe(demoGender);
    expect(partner?.status).toBe("approved");
    expect(
      isPairValidForCategory(
        category,
        [demo?.gender, partner?.gender] as ["male" | "female", "male" | "female"]
      )
    ).toBe(true);
  });

  it("reuses the same demo account and team on every repeat click", () => {
    const first = ensureDemoPlayerTestData(makeDoc(8), ADMIN, DEMO_ID);
    const second = ensureDemoPlayerTestData(first, ADMIN, DEMO_ID);

    expect(canLoadDemoTestData(second)).toBe(true);
    expect(second.teams).toHaveLength(first.teams.length);
    expect(second.registrations).toHaveLength(first.registrations!.length);
    expect(second.matches).toHaveLength(first.matches.length);
    expect(
      second.registrations?.filter((item) => item.uid === DEMO_ID.uid)
    ).toHaveLength(1);
    expect(second.teams.filter((team) => team.playerIds.includes(DEMO_ID.uid))).toHaveLength(1);
    expect(getRegisteredTeamId(second, DEMO_ID.uid)).toBe(
      getRegisteredTeamId(first, DEMO_ID.uid)
    );
  });

  it("reconnects a recreated auth account without duplicating the demo profile", () => {
    const original = ensureDemoPlayerTestData(makeDoc(8), ADMIN, DEMO_ID);
    const recreatedUid = "recreated-firebase-demo-uid";
    const reconnected = ensureDemoPlayerTestData(
      original,
      ADMIN,
      { ...DEMO_ID, uid: recreatedUid }
    );
    const teamId = getRegisteredTeamId(reconnected, recreatedUid);

    expect(findDemoRegistration(reconnected)?.uid).toBe(recreatedUid);
    expect(reconnected.registrations).toHaveLength(original.registrations!.length);
    expect(reconnected.teams).toHaveLength(original.teams.length);
    expect(teamId).not.toBeNull();
    expect(
      reconnected.teams.find((team) => team.id === teamId)?.playerIds
    ).toContain(recreatedUid);
    expect(getRegisteredTeamId(reconnected, DEMO_ID.uid)).toBeNull();
    expect(
      reconnected.auditLog?.some((entry) => entry.action === "demo-player-reconnected")
    ).toBe(true);
  });

  it("reloads the demo profile after a test-data reset without changing its auth identity", () => {
    ensureDemoPlayerTestData(makeDoc(8), ADMIN, DEMO_ID);
    const reloaded = ensureDemoPlayerTestData(makeDoc(8), ADMIN, DEMO_ID);

    expect(findDemoRegistration(reloaded)?.uid).toBe(DEMO_ID.uid);
    expect(reloaded.teams).toHaveLength(8);
    expect(getRegisteredTeamId(reloaded, DEMO_ID.uid)).not.toBeNull();
    expect(reloaded.tournament.status).toBe("group-stage");
  });
});
