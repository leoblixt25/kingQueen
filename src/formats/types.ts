/**
 * Format identification shared by the application.
 *
 * This is deliberately small: it only describes *which* tournament format is
 * being used. Tournament rules, data and algorithms must stay inside the
 * format's own module tree (see `src/formats/group-double-elimination/`).
 */

export type TournamentFormat = "king-queen" | "group-double-elimination";

export type TournamentFormatStatus = "live" | "in-development";

export interface TournamentFormatDefinition {
  id: TournamentFormat;
  /** Full display name. */
  name: string;
  /** Compact label for tight UI (cards, nav). */
  shortName: string;
  description: string;
  /** Public entry route for the format. */
  route: string;
  status: TournamentFormatStatus;
  /** Whether the format can be selected from the format chooser today. */
  selectable: boolean;
}

export const TOURNAMENT_FORMAT_IDS = [
  "king-queen",
  "group-double-elimination",
] as const satisfies readonly TournamentFormat[];

export const isTournamentFormat = (
  value: string
): value is TournamentFormat =>
  (TOURNAMENT_FORMAT_IDS as readonly string[]).includes(value);
