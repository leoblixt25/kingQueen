import type { GsdeTournamentDocument } from "./persistence";
import type { GsdeTournamentStatus } from "./types";
import { appendAudit, type AuditActor } from "./audit";

/**
 * Stage-sequence and reopen rules. Stages only move forward through the
 * normal workflow. Reopening a completed tournament is a privileged,
 * explicitly-confirmed action that is always written to the audit log.
 */

export const STAGE_ORDER: readonly GsdeTournamentStatus[] = [
  "draft",
  "configured",
  "group-stage",
  "elimination",
  "grand-final",
  "completed",
];

export type LifecycleErrorCode =
  | "stage-sequence"
  | "unauthorized"
  | "not-completed"
  | "confirm-discard";

export class LifecycleError extends Error {
  readonly code: LifecycleErrorCode;

  constructor(code: LifecycleErrorCode, message: string) {
    super(message);
    this.name = "LifecycleError";
    this.code = code;
  }
}

const fail = (code: LifecycleErrorCode, message: string): never => {
  throw new LifecycleError(code, message);
};

const indexOf = (status: GsdeTournamentStatus): number =>
  STAGE_ORDER.indexOf(status);

/** Reject mutations once the tournament has moved past a given stage. */
export const assertNotPastStage = (
  doc: GsdeTournamentDocument,
  stage: GsdeTournamentStatus
): void => {
  if (indexOf(doc.tournament.status) > indexOf(stage)) {
    fail(
      "stage-sequence",
      `Cannot change this stage data after "${doc.tournament.status}". Reopen the tournament first.`
    );
  }
};

/** Reject backwards/out-of-sequence stage transitions. */
export const assertStageAdvance = (
  doc: GsdeTournamentDocument,
  target: GsdeTournamentStatus
): void => {
  const current = indexOf(doc.tournament.status);
  const next = indexOf(target);
  if (next < 0 || current < 0) {
    fail("stage-sequence", `Unknown stage "${doc.tournament.status}" or "${target}".`);
  }
  if (next <= current) {
    fail(
      "stage-sequence",
      `Cannot move from "${doc.tournament.status}" back to "${target}".`
    );
  }
};

export const REOPEN_TARGETS = ["group-stage", "elimination"] as const;
export type ReopenTarget = (typeof REOPEN_TARGETS)[number];

export interface ReopenOptions {
  targetStage: ReopenTarget;
  /** Admin must confirm that results from later stages will be discarded. */
  discardResults: boolean;
}

/**
 * Reopen a completed tournament. Only an authorized admin may do this, and
 * later-stage results must be explicitly discarded. The action is audited.
 */
export const reopenTournament = (
  doc: GsdeTournamentDocument,
  actor: AuditActor,
  options: ReopenOptions
): GsdeTournamentDocument => {
  if (!actor.isAdmin) {
    fail("unauthorized", "Only an authorized admin can reopen a completed tournament.");
  }
  if (doc.tournament.status !== "completed") {
    fail("not-completed", "Only completed tournaments can be reopened.");
  }
  if (!REOPEN_TARGETS.includes(options.targetStage)) {
    fail("stage-sequence", `Cannot reopen to "${options.targetStage}".`);
  }
  if (!options.discardResults) {
    fail(
      "confirm-discard",
      "Reopening requires explicit confirmation that later-stage results are discarded."
    );
  }

  const toGroupStage = options.targetStage === "group-stage";
  const reopened: GsdeTournamentDocument = {
    ...doc,
    elimination: toGroupStage ? null : doc.elimination,
    tournament: {
      ...doc.tournament,
      status: options.targetStage,
      groupStageVerified: toGroupStage ? false : doc.tournament.groupStageVerified,
      seedingStale: toGroupStage ? true : false,
      bracketOverrideUsed: false,
    },
  };

  return appendAudit(reopened, {
    action: "tournament-reopened",
    actor,
    detail: `Reopened from completed to ${options.targetStage}; later-stage results discarded.`,
  });
};
