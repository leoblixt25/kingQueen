import type { AuditActor } from "./audit";
import { appendAudit } from "./audit";
import {
  derivePairTeamName,
  normalizeTournamentCategory,
  TEAM_PLAYER_COUNT,
} from "./category";
import type { GsdeTournamentDocument } from "./persistence";
import { buildTeamsAndGroups } from "./scoring";
import { createTeamId } from "./teams";
import type {
  PlayerGender,
  PlayerRegistration,
  Team,
  TournamentCategory,
} from "./types";

/**
 * Admin-only test data loader, equivalent to King & Queen's "Load Test
 * Players" button but scoped entirely to `tournaments/{id}`.
 *
 * This is a 2x2 format: every team is a fixed pair of two individual players.
 * The simulator therefore creates 2N approved player registrations and N
 * approved teams for the selected tournament size, with names derived from both
 * players. Pairs are created once and never reshuffled by group scheduling.
 *
 * Nothing here touches the K&Q `players`, `matches`, `finalMatches` or
 * `tournamentSettings` collections. Everything is audited as an admin action.
 */

export const SUPPORTED_TEST_TEAM_COUNTS = [8, 12, 16, 24, 32] as const;
export type TestTeamCount = (typeof SUPPORTED_TEST_TEAM_COUNTS)[number];

export const GROUP_COUNT_BY_TEAM_COUNT: Record<TestTeamCount, number> = {
  8: 2,
  12: 3,
  16: 4,
  24: 6,
  32: 8,
};

const MALE_FIRST_NAMES = [
  "Liam",
  "Noah",
  "Mateo",
  "Lucas",
  "Diego",
  "Andrés",
  "Felipe",
  "Sebastián",
  "Alex",
  "Daniel",
  "Samuel",
  "Gabriel",
  "Ethan",
  "Adrián",
  "Bruno",
  "Marco",
] as const;

const FEMALE_FIRST_NAMES = [
  "Sofia",
  "Emma",
  "Mia",
  "Isabella",
  "Olivia",
  "Ava",
  "Elena",
  "Camila",
  "Lucía",
  "Valentina",
  "Martina",
  "Paula",
  "Clara",
  "Sara",
  "Laura",
  "Nora",
] as const;

const SURNAMES = ["Smith", "Brown", "Wilson", "Martin"] as const;

export const TEST_PLAYER_UID_PREFIX = "gsde-test-player-";
export const TEST_PLAYER_EMAIL_PREFIX = "testplayer";

export const testPlayerUid = (index: number): string =>
  `${TEST_PLAYER_UID_PREFIX}${index + 1}`;

export const testPlayerEmail = (index: number): string =>
  `${TEST_PLAYER_EMAIL_PREFIX}${index + 1}@kingqueen.test`;

/** Loading is only safe before the group stage has produced results. */
export const canLoadTestData = (doc: GsdeTournamentDocument): boolean =>
  (doc.tournament.status === "draft" || doc.tournament.status === "configured") &&
  doc.matches.length === 0 &&
  !doc.elimination;

export class TestDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TestDataError";
  }
}

export const isTestTeamCount = (value: number): value is TestTeamCount =>
  SUPPORTED_TEST_TEAM_COUNTS.includes(value as TestTeamCount);

/** Resolve the configured team limit to one of the supported simulator sizes. */
export const resolveTestTeamCount = (teamLimit: number): TestTeamCount => {
  if (isTestTeamCount(teamLimit)) return teamLimit;
  if (!Number.isFinite(teamLimit) || teamLimit <= 12) return 8;
  if (teamLimit <= 16) return 16;
  if (teamLimit <= 24) return 24;
  return 32;
};

const playerName = (gender: PlayerGender, index: number): string => {
  const firstNames = gender === "male" ? MALE_FIRST_NAMES : FEMALE_FIRST_NAMES;
  return `${firstNames[index % firstNames.length]} ${
    SURNAMES[Math.floor(index / firstNames.length) % SURNAMES.length]
  }`;
};

interface GeneratedPlayer {
  uid: string;
  email: string;
  name: string;
  gender: PlayerGender;
}

export interface GeneratedPair {
  team: Team;
  players: [GeneratedPlayer, GeneratedPlayer];
}

/**
 * Build fixed two-player pairs for the selected category. Player indices are
 * assigned sequentially so uids/emails stay unique and stable across sizes.
 */
export const buildTestPairs = (
  teamCount: TestTeamCount,
  category: TournamentCategory
): GeneratedPair[] => {
  const normalized = normalizeTournamentCategory(category);
  const pairs: GeneratedPair[] = [];
  let playerIndex = 0;

  const nextPlayer = (gender: PlayerGender, poolIndex: number): GeneratedPlayer => {
    const player = {
      uid: testPlayerUid(playerIndex),
      email: testPlayerEmail(playerIndex),
      name: playerName(gender, poolIndex),
      gender,
    };
    playerIndex += 1;
    return player;
  };

  for (let teamIndex = 0; teamIndex < teamCount; teamIndex += 1) {
    let players: [GeneratedPlayer, GeneratedPlayer];
    if (normalized === "Mixto") {
      players = [
        nextPlayer("male", teamIndex),
        nextPlayer("female", teamIndex),
      ];
    } else {
      const gender: PlayerGender = normalized === "Male" ? "male" : "female";
      players = [
        nextPlayer(gender, teamIndex * TEAM_PLAYER_COUNT),
        nextPlayer(gender, teamIndex * TEAM_PLAYER_COUNT + 1),
      ];
    }

    const name = derivePairTeamName(players.map((player) => player.name));
    pairs.push({
      players,
      team: {
        id: createTeamId(name),
        name,
        playerIds: players.map((player) => player.uid),
        seed: teamIndex + 1,
        groupId: null,
        status: "approved",
        nameIsCustom: false,
      },
    });
  }

  return pairs;
};

/**
 * Replace teams and registrations with approved 2x2 test data and generate the
 * group schedule. Pure: the caller persists the returned document.
 */
export const loadTestTeamsAndPlayers = (
  doc: GsdeTournamentDocument,
  actor: AuditActor
): GsdeTournamentDocument => {
  if (!canLoadTestData(doc)) {
    throw new TestDataError(
      "Test data can only be loaded before the group stage starts. Reopen or reset the tournament first."
    );
  }

  const teamCount = resolveTestTeamCount(doc.tournament.config.teamLimit);
  const category = normalizeTournamentCategory(doc.tournament.config.category);
  const pairs = buildTestPairs(teamCount, category);
  const teams = pairs.map((pair) => pair.team);
  const now = new Date().toISOString();
  const registrations: PlayerRegistration[] = pairs.flatMap((pair) =>
    pair.players.map((player) => ({
      uid: player.uid,
      email: player.email,
      name: player.name,
      gender: player.gender,
      status: "approved" as const,
      teamId: pair.team.id,
      registeredAt: now,
      decidedAt: now,
    }))
  );

  const seeded = buildTeamsAndGroups(
    {
      ...doc,
      tournament: {
        ...doc.tournament,
        config: {
          ...doc.tournament.config,
          category,
          teamLimit: teamCount,
          groupCount: GROUP_COUNT_BY_TEAM_COUNT[teamCount],
          teamsPerGroup: 4,
        },
      },
      teams,
      registrations,
      scoreSubmissions: {},
      elimination: null,
    },
    teams,
    actor
  );

  return appendAudit(seeded, {
    action: "test-data-loaded",
    actor,
    detail: `Loaded ${teams.length} approved ${category} test pairs and ${registrations.length} approved test players.`,
  });
};
