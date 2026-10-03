/**
 * Resolves the Tournament King and Queen from the submitted final match.
 *
 * The final document is the single source of truth: it already stores the
 * winning male and female player ids, so nothing here recomputes winners and
 * draw/ranking/final logic stays untouched.
 *
 * Highlighting is only ever active once the final has been submitted.
 */

export interface WinnerPlayerRef {
  id: string;
  name?: string | null;
  gender?: string | null;
}

export interface WinnerNames {
  kingName: string | null;
  queenName: string | null;
}

export interface FinalMatchWinnerFields {
  is_completed?: boolean | null;
  male_king_id?: string | null;
  female_queen_id?: string | null;
}

const NONE: WinnerNames = { kingName: null, queenName: null };

const nameFor = (
  players: WinnerPlayerRef[],
  id: string | null | undefined,
  expectedGender: 'male' | 'female'
): string | null => {
  if (!id) return null;
  const player = players.find((p) => p.id === id);
  if (!player) return null;
  // Guards against a stale/wrong id silently bolding the wrong person.
  if (player.gender && player.gender !== expectedGender) return null;
  const name = typeof player.name === 'string' ? player.name.trim() : '';
  return name.length > 0 ? name : null;
};

/**
 * Returns the King/Queen display names, or nulls when the tournament has not
 * finished. Each side resolves independently so a partially written document
 * still highlights whoever is known.
 */
export function resolveTournamentWinners(
  finalData: FinalMatchWinnerFields | null | undefined,
  players: WinnerPlayerRef[]
): WinnerNames {
  if (!finalData || finalData.is_completed !== true) return NONE;
  if (!Array.isArray(players) || players.length === 0) return NONE;

  return {
    kingName: nameFor(players, finalData.male_king_id, 'male'),
    queenName: nameFor(players, finalData.female_queen_id, 'female'),
  };
}

/**
 * Exact, case-sensitive match only.
 *
 * Names are matched whole rather than by substring so that distinct players
 * whose names merely overlap (e.g. "Giulia" and "Giulia P") are never confused.
 */
export function isWinnerName(name: string | null | undefined, winners: WinnerNames): boolean {
  if (typeof name !== 'string') return false;
  const candidate = name.trim();
  if (!candidate) return false;
  return candidate === winners.kingName || candidate === winners.queenName;
}

/** Convenience wrapper: the class to apply to a rendered name. */
export function winnerNameClass(
  name: string | null | undefined,
  winners: WinnerNames
): string {
  return isWinnerName(name, winners) ? 'font-bold' : '';
}