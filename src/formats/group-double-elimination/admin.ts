import type { GsdeTournamentStatus } from "./types";

/**
 * New-format admin functionality contract.
 *
 * Defines the admin workflow sections and the tournament status each section
 * becomes available in. No Firestore access and no persistence in Phase 2.
 */
export type GsdeAdminSectionId =
  | "setup"
  | "teams"
  | "groups"
  | "bracket"
  | "scoring";

export interface GsdeAdminSection {
  id: GsdeAdminSectionId;
  title: string;
  description: string;
  /** Tournament statuses in which this section is usable. */
  availableFrom: readonly GsdeTournamentStatus[];
}

export const GSDE_ADMIN_SECTIONS: readonly GsdeAdminSection[] = [
  {
    id: "setup",
    title: "Tournament setup",
    description:
      "Name, division and group count. Format rules (all teams advance, reset final) are fixed.",
    availableFrom: ["draft"],
  },
  {
    id: "teams",
    title: "Teams",
    description:
      "Create teams and optionally link them to existing player identities.",
    availableFrom: ["draft"],
  },
  {
    id: "groups",
    title: "Groups",
    description:
      "Distribute teams into groups and review the round-robin schedule before generating it.",
    availableFrom: ["configured"],
  },
  {
    id: "bracket",
    title: "Bracket",
    description:
      "Seed the double-elimination bracket from the group standings, then generate it.",
    availableFrom: ["group-stage"],
  },
  {
    id: "scoring",
    title: "Scoring",
    description:
      "Enter single-set scores for group and elimination matches and follow progression.",
    availableFrom: ["group-stage", "elimination", "grand-final"],
  },
];
