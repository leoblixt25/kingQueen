export type GroupStageErrorCode =
  | "invalid-team"
  | "duplicate-team"
  | "invalid-group-count"
  | "invalid-group-sizes"
  | "not-enough-teams"
  | "duplicate-group"
  | "unassigned-teams"
  | "invalid-group-match"
  | "invalid-score";

/**
 * Typed validation failure for the group-stage engine.
 *
 * The engine is pure and framework-free; callers (future admin UI or store)
 * decide how to surface these errors.
 */
export class GroupStageError extends Error {
  readonly code: GroupStageErrorCode;

  constructor(code: GroupStageErrorCode, message: string) {
    super(message);
    this.name = "GroupStageError";
    this.code = code;
  }
}
