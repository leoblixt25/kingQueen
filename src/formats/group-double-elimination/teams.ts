import type { GroupId, PlayerId, Team, TeamId } from "./types";
import { notImplemented } from "./notImplemented";

/**
 * Team management contract.
 *
 * Teams are new-format entities. They may reference existing player ids, but
 * they must never be written to the King & Queen `players` collection.
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

export const createTeam = (
  _id: TeamId,
  _draft: TeamDraft,
  _groupId?: GroupId | null
): Team => notImplemented("Team creation");

export const validateTeamDraft = (
  _draft: TeamDraft,
  _existing: readonly Team[]
): TeamValidationIssue[] => notImplemented("Team validation");

export const moveTeamToGroup = (
  _team: Team,
  _groupId: GroupId | null
): Team => notImplemented("Team group assignment");
