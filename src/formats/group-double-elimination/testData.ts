import type { AuditActor } from "./audit";
import { appendAudit } from "./audit";
import type { GsdeTournamentDocument } from "./persistence";
import { buildTeamsAndGroups } from "./scoring";
import { createTeamId } from "./teams";
import type { PlayerRegistration, Team } from "./types";

/**
 * Admin-only test data loader, equivalent to King & Queen's "Load Test
 * Players" button but scoped entirely to `tournaments/{id}`.
 *
 * It creates 16 approved placeholder teams, 16 approved player registrations
 * (each already assigned to a team), then builds the fixed 4-group / 24-match
 * schedule so the format can be exercised immediately. The first three test
 * accounts already exist in Firebase Auth (`gsde-test-player-1..3`), so those
 * players can sign in and submit scores on real matches.
 *
 * Nothing here touches the K&Q `players`, `matches`, `finalMatches` or
 * `tournamentSettings` collections. Everything is audited as an admin action.
 */

export const TEST_TEAM_NAMES = [
  "Sofia",
  "Emma",
  "Mia",
  "Isabella",
  "Olivia",
  "Ava",
  "Elena",
  "Camila",
  "Liam",
  "Noah",
  "Mateo",
  "Lucas",
  "Diego",
  "Andrés",
  "Felipe",
  "Sebastián",
] as const;

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

/**
 * Replace teams and registrations with approved test data and generate the
 * full group schedule. Pure: the caller persists the returned document.
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

  const now = new Date().toISOString();
  const teams: Team[] = TEST_TEAM_NAMES.map((name, index) => ({
    id: createTeamId(name),
    name,
    playerIds: [testPlayerUid(index)],
    seed: index + 1,
    groupId: null,
    status: "approved",
  }));
  const registrations: PlayerRegistration[] = TEST_TEAM_NAMES.map(
    (name, index) => ({
      uid: testPlayerUid(index),
      email: testPlayerEmail(index),
      name,
      status: "approved",
      teamId: createTeamId(name),
      registeredAt: now,
      decidedAt: now,
    })
  );

  const seeded = buildTeamsAndGroups(
    {
      ...doc,
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
    detail: `Loaded ${teams.length} approved test teams and ${registrations.length} approved test players.`,
  });
};
