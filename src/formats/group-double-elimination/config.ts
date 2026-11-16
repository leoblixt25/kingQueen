import type { TournamentConfig } from "./types";

/**
 * Tournament configuration for the new format.
 *
 * These are rules of the format, not user data: all teams advance from the
 * groups, every team starts the elimination stage with zero losses, and the
 * Grand Final resets if the Losers champion wins the first one.
 */
export const DEFAULT_CONFIG: TournamentConfig = {
  name: "",
  divisionName: "Open",
  groupCount: 2,
  matchFormat: "single-set",
  teamsPerGroup: null,
  advanceAllTeams: true,
  grandFinalReset: true,
};

export const createTournamentConfig = (
  overrides: Partial<TournamentConfig> = {}
): TournamentConfig => ({ ...DEFAULT_CONFIG, ...overrides });

/** Bounds for the future admin configuration form. No validation logic yet. */
export const CONFIG_LIMITS = {
  minGroups: 1,
  maxGroups: 16,
  minTeams: 2,
  maxTeams: 64,
} as const;
