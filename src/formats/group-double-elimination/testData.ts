import type { AuditActor } from "./audit";
import { appendAudit } from "./audit";
import {
  derivePairTeamName,
  normalizeTournamentCategory,
  TEAM_PLAYER_COUNT,
} from "./category";
import {
  findRegistrationByEmail,
  findRegistrationByUid,
  getRegisteredTeamId,
  normalizeRegistrationEmail,
  withPlayerPairingIndex,
} from "./registration";
import type { GsdeTournamentDocument } from "./persistence";
import { listEliminationMatches } from "./bracket";
import { getGameNumber } from "./gameNumbers";
import {
  approvePlayerRegistration,
  buildTeamsAndGroups,
  generateEliminationBracket,
  registerPlayer,
  scoreEliminationMatch,
  scoreGroupMatch,
  startGroupStage,
} from "./scoring";
import { acceptPairingInvitation, sendPairingInvitation } from "./pairing";
import { createTeamId } from "./teams";
import type {
  PairingInvitationMap,
  PairingResponseMap,
  PlayerGender,
  PlayerId,
  PlayerRegistration,
  ScoreSubmissionMap,
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

/**
 * Optional result simulation when loading test data.
 * - `none`: only teams, registrations and the schedule (admin enters scores).
 * - `groups`: every group match gets a random result.
 * - `full`: group results plus the whole elimination bracket, up to a champion.
 */
export type TestResultMode = "none" | "groups" | "full";

export const TEST_RESULT_MODE_OPTIONS: ReadonlyArray<{
  value: TestResultMode;
  label: string;
}> = [
  { value: "none", label: "Teams & schedule only" },
  { value: "groups", label: "Random group scores only" },
  { value: "full", label: "Random scores · full tournament" },
];

export interface TestDataOptions {
  /** Result simulation to apply after loading teams. Defaults to `none`. */
  results?: TestResultMode;
  /** Injectable RNG so tests are deterministic. Defaults to `Math.random`. */
  rng?: () => number;
  /**
   * Real auth identity to use as the first player of pair #1. When present the
   * loader also activates the group stage so the account behaves exactly like
   * an ordinary approved, paired tournament participant.
   */
  demo?: DemoPlayerIdentity;
}

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

/** Stable identity of the reusable, real Firebase Auth demo account. */
export const DEMO_PLAYER_EMAIL = "player@player.com";
export const DEMO_PLAYER_NAME = "Demo Player";

export const testPlayerUid = (index: number): string =>
  `${TEST_PLAYER_UID_PREFIX}${index + 1}`;

export const testPlayerEmail = (index: number): string =>
  `${TEST_PLAYER_EMAIL_PREFIX}${index + 1}@kingqueen.test`;

/**
 * The demo account always comes from the real auth system, so its uid is only
 * known after provisioning. The rest of the simulator is pure and accepts it
 * as an explicit identity instead of inventing a second, fake login.
 */
export interface DemoPlayerIdentity {
  uid: PlayerId;
  email?: string;
  name?: string;
}

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
  category: TournamentCategory,
  demo?: DemoPlayerIdentity
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
    if (teamIndex === 0 && demo) {
      // Keep the pair category-valid in every division: Demo Player is male in
      // Male/Mixto and female in Female; the partner is generated from the
      // existing test pool with the complementary gender for Mixto.
      const demoGender: PlayerGender = normalized === "Female" ? "female" : "male";
      const partnerGender: PlayerGender =
        normalized === "Mixto" ? "female" : demoGender;
      players = [
        {
          uid: demo.uid,
          email: normalizeRegistrationEmail(demo.email ?? DEMO_PLAYER_EMAIL),
          name: demo.name?.trim() || DEMO_PLAYER_NAME,
          gender: demoGender,
        },
        nextPlayer(partnerGender, 0),
      ];
    } else if (normalized === "Mixto") {
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

/** Random integer in [0, maxInclusive], clamped for injected RNGs. */
const randomInt = (rng: () => number, maxInclusive: number): number =>
  Math.min(maxInclusive, Math.max(0, Math.floor(rng() * (maxInclusive + 1))));

/**
 * Random single-set score: the winner has 21, the loser 0–19 so the result is
 * always a valid beach-volleyball win (at least 21 with a two-point lead).
 * `winnerIsTeamA` decides which side receives the 21.
 */
const randomScore = (
  rng: () => number,
  winnerIsTeamA: boolean
): { scoreA: number; scoreB: number } => {
  const loserScore = randomInt(rng, 19);
  return winnerIsTeamA
    ? { scoreA: 21, scoreB: loserScore }
    : { scoreA: loserScore, scoreB: 21 };
};

const simulateGroupResults = (
  doc: GsdeTournamentDocument,
  actor: AuditActor,
  rng: () => number
): GsdeTournamentDocument => {
  let next = startGroupStage(doc, actor);
  for (const match of [...next.matches]) {
    if (match.status === "completed") continue;
    const { scoreA, scoreB } = randomScore(rng, rng() < 0.5);
    next = scoreGroupMatch(next, match.id, scoreA, scoreB, actor);
  }
  return next;
};

const simulateEliminationResults = (
  doc: GsdeTournamentDocument,
  actor: AuditActor,
  rng: () => number
): GsdeTournamentDocument => {
  let next = doc;
  // Bounded loop: the longest supported bracket finishes well below this.
  for (let step = 0; step < 500; step += 1) {
    if (next.tournament.status === "completed" || !next.elimination) return next;

    const playable = listEliminationMatches(next.elimination)
      .filter(
        (match) =>
          match.status !== "completed" &&
          match.teamAId !== null &&
          match.teamBId !== null
      )
      .sort(
        (a, b) =>
          (getGameNumber(a.id) ?? Number.MAX_SAFE_INTEGER) -
          (getGameNumber(b.id) ?? Number.MAX_SAFE_INTEGER)
      );
    const match = playable[0];
    if (!match || match.teamAId === null || match.teamBId === null) return next;

    const winnerIsTeamA = rng() < 0.5;
    const { scoreA, scoreB } = randomScore(rng, winnerIsTeamA);
    next = scoreEliminationMatch(
      next,
      {
        matchId: match.id,
        winnerId: winnerIsTeamA ? match.teamAId : match.teamBId,
        loserId: winnerIsTeamA ? match.teamBId : match.teamAId,
        scoreA,
        scoreB,
      },
      actor
    );
  }
  return next;
};

/**
 * Replace teams and registrations with approved 2x2 test data and generate the
 * group schedule. Pure: the caller persists the returned document.
 *
 * `options.results` can additionally fill random scores (winner 21, loser
 * 0–19) for the group stage and, with `full`, play the entire elimination
 * bracket through to a champion. Passing `rng` makes the simulation
 * deterministic for tests.
 */
export const loadTestTeamsAndPlayers = (
  doc: GsdeTournamentDocument,
  actor: AuditActor,
  options: TestDataOptions = {}
): GsdeTournamentDocument => {
  if (!canLoadTestData(doc)) {
    throw new TestDataError(
      "Test data can only be loaded before the group stage starts. Reopen or reset the tournament first."
    );
  }

  const teamCount = resolveTestTeamCount(doc.tournament.config.teamLimit);
  const category = normalizeTournamentCategory(doc.tournament.config.category);
  const pairs = buildTestPairs(teamCount, category, options.demo);

  // Simulate the real player workflow rather than injecting finished teams:
  // individual registrations → compatible invitations → accepted invitations
  // (which create the fixed teams) → admin approval → group schedule.
  let seeded: GsdeTournamentDocument = {
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
    teams: [],
    groups: [],
    matches: [],
    registrations: [],
    pairingInvitations: {},
    pairingResponses: {},
    scoreSubmissions: {},
    elimination: null,
  };

  // 1. Each player registers as an individual.
  for (const pair of pairs) {
    for (const player of pair.players) {
      seeded = registerPlayer(seeded, player, actor);
    }
  }

  // 2. Admin approves every individual player. Pairing is gated on approval.
  for (const pair of pairs) {
    for (const player of pair.players) {
      seeded = approvePlayerRegistration(seeded, player.uid, actor);
    }
  }

  // 3 & 4. A compatible invitation is sent and accepted, creating one confirmed
  // team per pair. Registrations keep their independent approved status.
  for (const pair of pairs) {
    const [inviter, invitee] = pair.players;
    const invited = sendPairingInvitation(seeded, inviter.uid, invitee.uid, actor);
    seeded = acceptPairingInvitation(invited, invitee.uid, inviter.uid, actor);
  }

  // Pair-created teams start unseeded; keep the simulator's stable 1..N order.
  seeded = {
    ...seeded,
    teams: seeded.teams.map((team, index) => ({ ...team, seed: index + 1 })),
  };

  const teams = seeded.teams;
  const registrations: PlayerRegistration[] = seeded.registrations ?? [];
  const scheduled = buildTeamsAndGroups(seeded, teams, actor);

  const demoDetail = options.demo
    ? ` ${DEMO_PLAYER_NAME} (${normalizeRegistrationEmail(options.demo.email ?? DEMO_PLAYER_EMAIL)}) was registered, approved and paired through the real auth identity ${options.demo.uid}.`
    : "";
  const loaded = appendAudit(scheduled, {
    action: "test-data-loaded",
    actor,
    detail: `Loaded ${teams.length} approved ${category} test pairs and ${registrations.length} approved test players via individual registrations and accepted pairing invitations.${demoDetail}`,
  });

  const mode = options.results ?? "none";
  if (mode === "none") {
    // A demo login must land on a live tournament, so start the group stage
    // after generating the schedule. Existing tests without a demo keep the
    // original draft/configured behaviour.
    return options.demo ? startGroupStage(loaded, actor) : loaded;
  }

  const rng = options.rng ?? Math.random;
  const withGroupResults = simulateGroupResults(loaded, actor, rng);
  if (mode === "groups") return withGroupResults;

  const withBracket = generateEliminationBracket(withGroupResults, {}, actor);
  return simulateEliminationResults(withBracket, actor, rng);
};

/** Find the reusable demo registration by its stable email, never by a guessed uid. */
export const findDemoRegistration = (
  doc: GsdeTournamentDocument
): PlayerRegistration | undefined => findRegistrationByEmail(doc, DEMO_PLAYER_EMAIL);

const activeTeamsForPlayer = (
  doc: GsdeTournamentDocument,
  uid: PlayerId
): Team[] =>
  doc.teams.filter(
    (team) => team.status !== "pending" && team.playerIds.includes(uid)
  );

/**
 * The demo account is only "ready" when the whole player journey is intact:
 * approved registration, exactly one confirmed team with a valid approved
 * partner, a real group assignment and at least one group match for the team.
 */
const hasCompleteDemoJourney = (
  doc: GsdeTournamentDocument,
  uid: PlayerId
): boolean => {
  const registration = findRegistrationByUid(doc, uid);
  if (
    !registration ||
    normalizeRegistrationEmail(registration.email) !== DEMO_PLAYER_EMAIL ||
    registration.status !== "approved"
  ) {
    return false;
  }

  const teams = activeTeamsForPlayer(doc, uid);
  if (teams.length !== 1) return false;
  const team = teams[0];
  if (team.playerIds.length !== TEAM_PLAYER_COUNT) return false;

  const partnerUid = team.playerIds.find((playerUid) => playerUid !== uid);
  const partner = partnerUid ? findRegistrationByUid(doc, partnerUid) : undefined;
  if (!partner || partner.status !== "approved") return false;

  const group = team.groupId
    ? doc.groups.find((item) => item.id === team.groupId)
    : undefined;
  if (!group || !group.teamIds.includes(team.id)) return false;

  return doc.matches.some(
    (match) => match.teamAId === team.id || match.teamBId === team.id
  );
};

/** True when an already-loaded tournament contains a usable demo participant. */
export const hasValidDemoSetup = (doc: GsdeTournamentDocument): boolean => {
  const registration = findDemoRegistration(doc);
  return Boolean(registration && hasCompleteDemoJourney(doc, registration.uid));
};

/** The button stays available on an already-loaded demo tournament for repeat clicks. */
export const canLoadDemoTestData = (doc: GsdeTournamentDocument): boolean =>
  canLoadTestData(doc) || Boolean(findDemoRegistration(doc));

/** Keep the stored profile name/email aligned with the real auth account. */
const syncDemoProfile = (
  doc: GsdeTournamentDocument,
  demo: DemoPlayerIdentity
): GsdeTournamentDocument => {
  const email = normalizeRegistrationEmail(demo.email ?? DEMO_PLAYER_EMAIL);
  const name = demo.name?.trim() || DEMO_PLAYER_NAME;
  const registration = findDemoRegistration(doc);
  if (!registration) return doc;

  let next: GsdeTournamentDocument = doc;
  if (registration.email !== email || registration.name !== name) {
    next = {
      ...next,
      registrations: (next.registrations ?? []).map((item) =>
        item.uid === registration.uid ? { ...item, email, name } : item
      ),
    };
  }

  const teamId = getRegisteredTeamId(next, registration.uid);
  if (teamId) {
    next = {
      ...next,
      teams: next.teams.map((team) => {
        if (team.id !== teamId || team.nameIsCustom) return team;
        const names = team.playerIds.map(
          (uid) => findRegistrationByUid(next, uid)?.name ?? ""
        );
        return { ...team, name: derivePairTeamName(names) };
      }),
    };
  }
  return next;
};

/**
 * Reconnect every stored reference when the auth account was recreated with a
 * new uid. No auth user or tournament record is deleted or duplicated.
 */
const reconnectDemoUid = (
  doc: GsdeTournamentDocument,
  from: PlayerId,
  to: PlayerId
): GsdeTournamentDocument => {
  if (from === to) return doc;

  const invitations: PairingInvitationMap = {};
  for (const [key, invitation] of Object.entries(doc.pairingInvitations ?? {})) {
    invitations[key === from ? to : key] = {
      ...invitation,
      id: invitation.id === from ? to : invitation.id,
      inviterUid: invitation.inviterUid === from ? to : invitation.inviterUid,
      inviteeUid: invitation.inviteeUid === from ? to : invitation.inviteeUid,
    };
  }

  const responses: PairingResponseMap = {};
  for (const [key, response] of Object.entries(doc.pairingResponses ?? {})) {
    responses[key === from ? to : key] = {
      ...response,
      invitationId: response.invitationId === from ? to : response.invitationId,
    };
  }

  const submissions: ScoreSubmissionMap = {};
  for (const [key, byMatch] of Object.entries(doc.scoreSubmissions ?? {})) {
    submissions[key === from ? to : key] = Object.fromEntries(
      Object.entries(byMatch).map(([matchId, submission]) => [
        matchId,
        submission.playerUid === from
          ? { ...submission, playerUid: to }
          : submission,
      ])
    );
  }

  return withPlayerPairingIndex({
    ...doc,
    registrations: (doc.registrations ?? []).map((item) =>
      item.uid === from ? { ...item, uid: to } : item
    ),
    teams: doc.teams.map((team) =>
      team.playerIds.includes(from)
        ? {
            ...team,
            playerIds: team.playerIds.map((uid) => (uid === from ? to : uid)),
          }
        : team
    ),
    pairingInvitations: invitations,
    pairingResponses: responses,
    scoreSubmissions: submissions,
  });
};

/**
 * Idempotent entry point used by the admin button. It first repairs/reuses an
 * existing demo participant, and only runs the full simulator when the test
 * tournament has been reset. The auth account itself is provisioned by the
 * caller, so a test-data reset can never delete or disconnect it.
 */
export const ensureDemoPlayerTestData = (
  doc: GsdeTournamentDocument,
  actor: AuditActor,
  demo: DemoPlayerIdentity,
  options: Omit<TestDataOptions, "demo"> = {}
): GsdeTournamentDocument => {
  const existing = findDemoRegistration(doc);

  if (existing && existing.uid !== demo.uid) {
    if (!hasCompleteDemoJourney(doc, existing.uid)) {
      throw new TestDataError(
        "The Demo Player profile is incomplete. Reset tournament data and load it again."
      );
    }
    const reconnected = reconnectDemoUid(doc, existing.uid, demo.uid);
    return appendAudit(syncDemoProfile(reconnected, demo), {
      action: "demo-player-reconnected",
      actor,
      detail: `${DEMO_PLAYER_NAME} was reconnected to auth account ${demo.uid}.`,
    });
  }

  if (existing && hasCompleteDemoJourney(doc, demo.uid)) {
    const reconciled = syncDemoProfile(doc, demo);
    // Older test data can still be in `configured`; activate it on the first
    // repeat click without rebuilding teams or wiping submitted scores.
    if (
      reconciled.tournament.status === "configured" &&
      reconciled.matches.length > 0
    ) {
      return startGroupStage(withPlayerPairingIndex(reconciled), actor);
    }
    return withPlayerPairingIndex(reconciled);
  }

  if (!canLoadTestData(doc)) {
    throw new TestDataError(
      "Test data can only be loaded before the group stage starts. Use \"Delete all tournament data\" to reset first."
    );
  }

  return loadTestTeamsAndPlayers(doc, actor, { ...options, demo });
};
