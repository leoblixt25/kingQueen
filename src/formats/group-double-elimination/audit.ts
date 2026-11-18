import type { GsdeTournamentDocument } from "./persistence";
import type { MatchId, TeamId } from "./types";

/**
 * Append-only audit trail for admin actions. Every correction, stage change,
 * bracket regeneration and reopen writes one entry, so a completed result can
 * never change silently.
 */

export type AuditAction =
  | "setup-saved"
  | "team-added"
  | "team-edited"
  | "team-approved"
  | "team-removed"
  | "groups-generated"
  | "group-match-started"
  | "group-score-entered"
  | "group-score-corrected"
  | "group-match-reset"
  | "group-stage-completed"
  | "bracket-generated"
  | "bracket-override-generated"
  | "bracket-reset"
  | "elimination-score-entered"
  | "elimination-result-corrected"
  | "tournament-reopened"
  | "tournament-reset"
  | "test-data-loaded"
  | "player-registered"
  | "player-registration-approved"
  | "player-registration-rejected"
  | "player-registration-removed";

export interface AuditActor {
  id: string;
  label: string;
  isAdmin: boolean;
}

export const UNKNOWN_ADMIN: AuditActor = {
  id: "unknown",
  label: "Admin",
  isAdmin: true,
};

export interface AuditEntry {
  /** Stable, unique id within the tournament. */
  id: string;
  at: string;
  actorId: string;
  actorLabel: string;
  action: AuditAction;
  matchId?: MatchId;
  teamId?: TeamId;
  detail?: string;
}

export interface AuditInput {
  action: AuditAction;
  actor?: AuditActor;
  matchId?: MatchId;
  teamId?: TeamId;
  detail?: string;
}

/** Keep the log bounded while retaining the newest actions. */
export const AUDIT_LOG_LIMIT = 500;

export const appendAudit = (
  doc: GsdeTournamentDocument,
  input: AuditInput
): GsdeTournamentDocument => {
  const actor = input.actor ?? UNKNOWN_ADMIN;
  const at = new Date().toISOString();
  const existing = doc.auditLog ?? [];
  const entry: AuditEntry = {
    id: `audit-${existing.length + 1}-${at}`,
    at,
    actorId: actor.id,
    actorLabel: actor.label,
    action: input.action,
    ...(input.matchId ? { matchId: input.matchId } : {}),
    ...(input.teamId ? { teamId: input.teamId } : {}),
    ...(input.detail ? { detail: input.detail } : {}),
  };

  return {
    ...doc,
    auditLog: [...existing, entry].slice(-AUDIT_LOG_LIMIT),
  };
};

/** Corrections are the privacy-sensitive subset admins will filter for. */
export const selectCorrections = (
  doc: GsdeTournamentDocument
): AuditEntry[] =>
  (doc.auditLog ?? []).filter(
    (entry) =>
      entry.action === "group-score-corrected" ||
      entry.action === "elimination-result-corrected" ||
      entry.action === "group-match-reset" ||
      entry.action === "bracket-reset" ||
      entry.action === "bracket-override-generated" ||
      entry.action === "tournament-reopened" ||
      entry.action === "tournament-reset" ||
      entry.action === "player-registration-approved" ||
      entry.action === "player-registration-rejected" ||
      entry.action === "player-registration-removed"
  );
