export class NotImplementedError extends Error {
  constructor(feature: string) {
    super(
      `${feature} is not implemented yet (Phase 2 architecture scaffolding).`
    );
    this.name = "NotImplementedError";
  }
}

/**
 * Marks a future engine entry point. Phase 2 defines contracts only; the
 * algorithms are added in a later, separately approved phase.
 */
export const notImplemented = (feature: string): never => {
  throw new NotImplementedError(feature);
};
