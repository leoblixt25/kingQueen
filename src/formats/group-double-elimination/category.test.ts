import { describe, expect, it } from "vitest";
import type { AuditActor } from "./audit";
import {
  categoryForGenders,
  isPairValidForCategory,
  refreshPairTeamNames,
  resolveTeamDisplayName,
  validateTeamCategory,
  validateTeamsForCategory,
} from "./category";
import {
  generateEliminationBracket,
  scoreGroupMatch,
  startGroupStage,
} from "./scoring";
import { validateTournamentIntegrity } from "./integrity";
import { listEliminationMatches } from "./bracket";
import { hasSpanishCrossover } from "./spanishCrossover";
import { createGsdeTournamentDocument } from "./persistence";
import {
  buildTestPairs,
  GROUP_COUNT_BY_TEAM_COUNT,
  loadTestTeamsAndPlayers,
  type TestTeamCount,
} from "./testData";
import type { TournamentCategory } from "./types";

const ADMIN: AuditActor = {
  id: "admin-1",
  label: "admin@kingqueen.test",
  isAdmin: true,
};

const makeDoc = (
  teamLimit: TestTeamCount = 8,
  category: TournamentCategory = "Mixto"
) => {
  const template = createGsdeTournamentDocument("category-test");
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

describe("2x2 category rules", () => {
  it("classifies the three valid pair types", () => {
    expect(categoryForGenders(["male", "male"])).toBe("Male");
    expect(categoryForGenders(["female", "female"])).toBe("Female");
    expect(categoryForGenders(["female", "male"])).toBe("Mixto");
    expect(categoryForGenders(["male"])).toBeNull();
  });

  it.each([
    ["Male", "male", "male"] as const,
    ["Female", "female", "female"] as const,
    ["Mixto", "male", "female"] as const,
  ])("accepts a valid %s pair", (category, first, second) => {
    expect(isPairValidForCategory(category, [first, second])).toBe(true);
  });

  it.each([
    ["Male", "male", "female"] as const,
    ["Female", "male", "female"] as const,
    ["Mixto", "male", "male"] as const,
    ["Mixto", "female", "female"] as const,
  ])("rejects an invalid %s pair", (category, first, second) => {
    expect(isPairValidForCategory(category, [first, second])).toBe(false);
  });

  it("generates category-correct fixed pairs for every supported size", () => {
    for (const size of [8, 12, 16, 24, 32] as const) {
      for (const category of ["Male", "Female", "Mixto"] as const) {
        const pairs = buildTestPairs(size, category);
        expect(pairs).toHaveLength(size);
        for (const pair of pairs) {
          expect(
            isPairValidForCategory(
              category,
              pair.players.map((player) => player.gender)
            )
          ).toBe(true);
        }
      }
    }
  });

  it("flags a corrupted pair in the integrity check", () => {
    const loaded = loadTestTeamsAndPlayers(makeDoc(8, "Mixto"), ADMIN);
    const firstUid = loaded.teams[0].playerIds[0];
    const corrupted = {
      ...loaded,
      registrations: loaded.registrations?.map((registration) =>
        registration.uid === firstUid ? { ...registration, gender: "female" as const } : registration
      ),
    };

    expect(
      validateTournamentIntegrity(corrupted).map((issue) => issue.code)
    ).toContain("invalid-team-category");
    expect(validateTeamsForCategory(corrupted)).toHaveLength(1);
    expect(validateTeamCategory(corrupted, loaded.teams[0])).toHaveLength(1);
  });

  it("leaves legacy genderless registrations alone", () => {
    const loaded = loadTestTeamsAndPlayers(makeDoc(8), ADMIN);
    const legacy = {
      ...loaded,
      registrations: loaded.registrations?.map(({ gender: _gender, ...rest }) => rest),
    };

    expect(validateTournamentIntegrity(legacy)).toEqual([]);
  });

  it("shows both player names and preserves custom names in labels", () => {
    const loaded = loadTestTeamsAndPlayers(makeDoc(8), ADMIN);
    const team = loaded.teams[0];
    const registrations = loaded.registrations ?? [];

    expect(resolveTeamDisplayName(registrations, team)).toBe(team.name);
    expect(resolveTeamDisplayName(registrations, { ...team, nameIsCustom: true })).toBe(
      team.name
    );
    expect(
      resolveTeamDisplayName(registrations, {
        ...team,
        name: "The Spikers",
        nameIsCustom: true,
      })
    ).toBe(`The Spikers (${team.name})`);
  });

  it("keeps a readable name when a pair loses one player", () => {
    const loaded = loadTestTeamsAndPlayers(makeDoc(8), ADMIN);
    const team = loaded.teams[0];
    const [firstUid, secondUid] = team.playerIds;
    const firstName = loaded.registrations?.find(
      (registration) => registration.uid === firstUid
    )?.name;

    const partial = refreshPairTeamNames({
      ...loaded,
      teams: loaded.teams.map((item) =>
        item.id === team.id
          ? { ...item, playerIds: [firstUid] }
          : item
      ),
      registrations: loaded.registrations?.filter(
        (registration) => registration.uid !== secondUid
      ),
    });

    expect(partial.find((item) => item.id === team.id)?.name).toBe(firstName);
    expect(refreshPairTeamNames(loaded).find((item) => item.id === team.id)?.name).toBe(
      team.name
    );
  });
});

describe("size-aware tournament flow", () => {
  it.each([8, 12, 24, 32] as const)(
    "runs a full %i-team group stage into a generic bracket",
    (teamCount) => {
      let doc = startGroupStage(
        loadTestTeamsAndPlayers(makeDoc(teamCount), ADMIN),
        ADMIN
      );
      expect(doc.matches).toHaveLength(GROUP_COUNT_BY_TEAM_COUNT[teamCount] * 6);

      for (const match of [...doc.matches]) {
        doc = scoreGroupMatch(doc, match.id, 21, 10);
      }
      doc = generateEliminationBracket(doc, {}, ADMIN);

      expect(doc.elimination).not.toBeNull();
      expect(doc.elimination?.seededTeamIds).toHaveLength(teamCount);
      expect(hasSpanishCrossover(doc.elimination!)).toBe(false);
      expect(validateTournamentIntegrity(doc)).toEqual([]);
    }
  );

  it("uses the canonical standard bracket for the fixed 16-team path", () => {
    let doc = startGroupStage(loadTestTeamsAndPlayers(makeDoc(16), ADMIN), ADMIN);
    for (const match of [...doc.matches]) {
      doc = scoreGroupMatch(doc, match.id, 21, 10);
    }
    doc = generateEliminationBracket(doc, {}, ADMIN);

    expect(doc.matches).toHaveLength(24);
    expect(doc.elimination?.seededTeamIds).toHaveLength(16);
    expect(hasSpanishCrossover(doc.elimination!)).toBe(false);
    expect(listEliminationMatches(doc.elimination!)).toHaveLength(30);
  });
});
