import type {
  TournamentFormat,
  TournamentFormatDefinition,
} from "./types";
import { TOURNAMENT_FORMAT_IDS } from "./types";

/**
 * Format registry.
 *
 * Metadata only. Routes are the approved public entry points from Phase 1 and
 * must not change without an explicit routing decision:
 * - King & Queen keeps every existing deep link; only its landing moved.
 * - The new format owns the `/formats/group-stage-double-elimination` namespace.
 */
export const KING_QUEEN_FORMAT: TournamentFormatDefinition = {
  id: "king-queen",
  name: "King & Queen of the Beach",
  shortName: "King & Queen",
  description:
    "The classic format: 8 players per division, a fresh partner every match, and a live ranking crown.",
  route: "/king-queen",
  status: "live",
  selectable: true,
};

export const GROUP_DOUBLE_ELIMINATION_FORMAT: TournamentFormatDefinition = {
  id: "group-double-elimination",
  name: "Group Stage + Double Elimination",
  shortName: "Groups + Double Elim",
  description:
    "Round-robin groups for every team, then a double-elimination bracket with a Grand Final.",
  route: "/formats/group-stage-double-elimination",
  status: "live",
  selectable: true,
};

const DEFINITIONS: Record<TournamentFormat, TournamentFormatDefinition> = {
  "king-queen": KING_QUEEN_FORMAT,
  "group-double-elimination": GROUP_DOUBLE_ELIMINATION_FORMAT,
};

export const TOURNAMENT_FORMAT_DEFINITIONS: readonly TournamentFormatDefinition[] =
  TOURNAMENT_FORMAT_IDS.map((id) => DEFINITIONS[id]);

export const getTournamentFormatDefinition = (
  id: TournamentFormat
): TournamentFormatDefinition => DEFINITIONS[id];
