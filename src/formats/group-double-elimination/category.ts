import type { GsdeTournamentDocument } from "./persistence";
import type {
  PlayerGender,
  PlayerRegistration,
  Team,
  TournamentCategory,
} from "./types";

/**
 * 2x2 category rules for the isolated GSDE tournament.
 *
 * A team is exactly two players. Male pairs are male+male, Female pairs are
 * female+female, and Mixto pairs are one of each. These helpers are pure so the
 * same rules can be applied by test-data generation, self-registration, admin
 * approval and the central integrity check.
 */

export const TEAM_PLAYER_COUNT = 2;
export const DEFAULT_TOURNAMENT_CATEGORY: TournamentCategory = "Mixto";

export const TOURNAMENT_CATEGORY_OPTIONS: ReadonlyArray<{
  value: TournamentCategory;
  label: string;
}> = [
  { value: "Mixto", label: "Mixto (one male + one female)" },
  { value: "Male", label: "Male (two male players)" },
  { value: "Female", label: "Female (two female players)" },
];

export const normalizeTournamentCategory = (
  value: unknown
): TournamentCategory => {
  if (value === "Male" || value === "Female" || value === "Mixto") return value;
  const lowered = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (lowered === "male" || lowered === "masculino") return "Male";
  if (lowered === "female" || lowered === "femenino") return "Female";
  if (lowered === "mixto" || lowered === "mixed" || lowered === "mixt") {
    return "Mixto";
  }
  return DEFAULT_TOURNAMENT_CATEGORY;
};

/** The category implied by exactly two player genders, or null if unknown. */
export const categoryForGenders = (
  genders: readonly PlayerGender[]
): TournamentCategory | null => {
  if (genders.length !== TEAM_PLAYER_COUNT) return null;
  const males = genders.filter((gender) => gender === "male").length;
  const females = genders.length - males;
  if (males === 2) return "Male";
  if (females === 2) return "Female";
  if (males === 1 && females === 1) return "Mixto";
  return null;
};

export const isPairValidForCategory = (
  category: TournamentCategory,
  genders: readonly PlayerGender[]
): boolean => categoryForGenders(genders) === normalizeTournamentCategory(category);

/** Build the default two-player team name shown everywhere in the UI. */
export const derivePairTeamName = (names: readonly string[]): string =>
  names.map((name) => name.trim()).filter(Boolean).join(" / ");

/** Player names for a team roster, in the order the players were paired. */
export const getTeamPlayerNames = (
  registrations: readonly PlayerRegistration[],
  team: Team
): string[] => {
  const names = new Map(
    registrations.map((registration) => [registration.uid, registration.name])
  );
  return team.playerIds
    .map((uid) => names.get(uid)?.trim())
    .filter((name): name is string => Boolean(name));
};

/**
 * Display label used across the UI. Pair-derived names are returned as-is;
 * custom names are preserved but annotated with both player names.
 */
export const resolveTeamDisplayName = (
  registrations: readonly PlayerRegistration[],
  team: Team
): string => {
  const players = getTeamPlayerNames(registrations, team);
  if (players.length !== TEAM_PLAYER_COUNT) return team.name;
  const pairName = derivePairTeamName(players);
  if (!team.nameIsCustom || team.name === pairName) return pairName;
  return `${team.name} (${pairName})`;
};

const genderByUid = (
  registrations: readonly PlayerRegistration[]
): Map<string, PlayerGender> => {
  const map = new Map<string, PlayerGender>();
  for (const registration of registrations) {
    if (registration.gender) map.set(registration.uid, registration.gender);
  }
  return map;
};

/**
 * Validate one team against the tournament category.
 *
 * Legacy teams with no gendered registrations are left alone so old documents
 * still load. As soon as a pair has known genders, both players are required
 * and must match the selected category.
 */
export const validateTeamCategory = (
  doc: GsdeTournamentDocument,
  team: Team
): string[] => {
  if (team.playerIds.length === 0) return [];

  const genders = genderByUid(doc.registrations ?? []);
  const known = team.playerIds
    .map((uid) => genders.get(uid))
    .filter((gender): gender is PlayerGender => Boolean(gender));

  // Incomplete or legacy genderless rosters are left alone; they are not yet
  // enforceable pairs. The separate team-size check rosters that exceed two
  // players; this helper only judges complete, known pairs.
  if (
    known.length !== TEAM_PLAYER_COUNT ||
    team.playerIds.length !== TEAM_PLAYER_COUNT
  ) {
    return [];
  }

  const category = normalizeTournamentCategory(doc.tournament.config.category);
  if (!isPairValidForCategory(category, known)) {
    return [
      `Team "${team.name}" is not a valid ${category} pair (${known.join(" + ")}).`,
    ];
  }
  return [];
};

export const validateTeamsForCategory = (
  doc: GsdeTournamentDocument,
  teams: readonly Team[] = doc.teams
): string[] => teams.flatMap((team) => validateTeamCategory(doc, team));

/**
 * Keep pair-derived names in sync when registrations are approved, rejected or
 * reassigned. Admin-entered custom names are never overwritten.
 */
export const refreshPairTeamNames = (
  doc: GsdeTournamentDocument
): Team[] =>
  doc.teams.map((team) => {
    if (team.nameIsCustom) return team;
    const players = getTeamPlayerNames(doc.registrations ?? [], team);
    if (players.length === 0) return team;
    // A partial roster (one player left) keeps a readable name instead of the
    // stale pair label; it becomes the full pair name again once both exist.
    const name = derivePairTeamName(players);
    return name === team.name ? team : { ...team, name };
  });
