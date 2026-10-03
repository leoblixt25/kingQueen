/**
 * Net (court) assignment for matchups.
 *
 * Display-only: nothing here affects seeding, ranking, scoring or the draw.
 *
 * The automatic assignment is a pure function of the match number (odd plays on
 * Net 1, even on Net 2), so it is stable for the life of a draw without ever
 * being written to Firestore. An admin override simply stores an explicit net on
 * the match document, which then wins over the automatic value.
 *
 * Matches created before this feature have no stored net, so they fall back to
 * the automatic rule and need no migration.
 */

export type NetNumber = 1 | 2;

export const NET_NUMBERS: NetNumber[] = [1, 2];

/** Only accepts a real Net 1 / Net 2 value; anything else is treated as unset. */
export function normalizeNet(value: unknown): NetNumber | null {
  if (value === 1 || value === '1') return 1;
  if (value === 2 || value === '2') return 2;
  return null;
}

/** Match 1, 3, 5, 7 -> Net 1. Match 2, 4, 6, 8 -> Net 2. */
export function autoNetForMatch(matchNumber: number): NetNumber {
  return matchNumber % 2 === 1 ? 1 : 2;
}

/** An admin override when one is stored, otherwise the automatic net. */
export function resolveNet(matchNumber: number, storedNet?: unknown): NetNumber {
  return normalizeNet(storedNet) ?? autoNetForMatch(matchNumber);
}

export function netLabel(net: NetNumber): string {
  return `Net ${net}`;
}

/** The net a match would move to when an admin toggles it. */
export function otherNet(net: NetNumber): NetNumber {
  return net === 1 ? 2 : 1;
}

/** Lookup key matching how matches are addressed: `${gender}_${matchNumber}`. */
export const netKey = (gender: string, matchNumber: number): string =>
  `${gender}_${matchNumber}`;

/**
 * Build the `${gender}_${match_number}` net lookup from match documents.
 *
 * Every known match gets an entry, using its stored net when present and the
 * automatic rule otherwise, so callers never have to handle a missing value.
 */
export function buildNetMap(
  docs: Array<{ gender?: unknown; match_number?: unknown; net?: unknown }>
): Record<string, NetNumber> {
  const map: Record<string, NetNumber> = {};
  (docs || []).forEach((m) => {
    if (!m) return;
    if (typeof m.gender !== 'string') return;
    if (typeof m.match_number !== 'number' || !Number.isFinite(m.match_number)) return;
    map[netKey(m.gender, m.match_number)] = resolveNet(m.match_number, m.net);
  });
  return map;
}