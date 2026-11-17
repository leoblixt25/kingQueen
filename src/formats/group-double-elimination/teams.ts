import type { GroupId, PlayerId, Team, TeamId } from "./types";
import { compareText } from "./compare";

/**
 * Team management for the new format. Teams are isolated entities: they may
 * reference existing player ids but are never written to King & Queen data.
 */

export interface TeamDraft {
  name: string;
  playerIds: PlayerId[];
  seed?: number | null;
}

export interface TeamValidationIssue {
  field: "name" | "playerIds" | "seed";
  message: string;
}

const normalizeName = (name: string): string => name.trim();

export const validateTeamDraft = (
  draft: TeamDraft,
  existing: readonly Team[]
): TeamValidationIssue[] => {
  const issues: TeamValidationIssue[] = [];
  const name = normalizeName(draft.name);

  if (name === "") {
    issues.push({ field: "name", message: "A team needs a name." });
  } else if (
    existing.some(
      (team) => compareText(team.name.trim().toLowerCase(), name.toLowerCase()) === 0
    )
  ) {
    issues.push({ field: "name", message: "A team with this name already exists." });
  }

  if (draft.seed !== undefined && draft.seed !== null) {
    if (!Number.isInteger(draft.seed) || draft.seed < 1) {
      issues.push({ field: "seed", message: "Seed must be a positive integer." });
    } else if (
      existing.some((team) => team.seed === draft.seed)
    ) {
      issues.push({ field: "seed", message: "Another team already has this seed." });
    }
  }

  if (new Set(draft.playerIds).size !== draft.playerIds.length) {
    issues.push({
      field: "playerIds",
      message: "A player cannot be linked twice to the same team.",
    });
  }

  return issues;
};

export const createTeam = (
  id: TeamId,
  draft: TeamDraft,
  groupId: GroupId | null = null
): Team => ({
  id,
  name: normalizeName(draft.name),
  playerIds: [...new Set(draft.playerIds)],
  seed: draft.seed ?? null,
  groupId,
});

/** Newly registered teams start unapproved until an admin approves them. */
export const createPendingTeam = (
  id: TeamId,
  draft: TeamDraft,
  groupId: GroupId | null = null
): Team => ({
  ...createTeam(id, draft, groupId),
  status: "pending",
});

export const moveTeamToGroup = (
  team: Team,
  groupId: GroupId | null
): Team => ({ ...team, groupId });

/** Deterministic id for a newly added team, based on its name. */
export const createTeamId = (name: string): TeamId =>
  `team-${normalizeName(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "unnamed"}`;
