/**
 * Deterministic string comparison.
 *
 * `localeCompare` can vary with the runtime locale, so the engines compare
 * code points instead. This keeps group allocation and tiebreakers identical
 * on every machine.
 */
export const compareText = (a: string, b: string): number => {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
};
