/**
 * Tournament run control.
 *
 * A single Firestore document (`tournamentSettings/tournament_control`) drives
 * three things: whether players may submit scores, and the start/end timestamps
 * used by the tournament timer. It is deliberately kept in its own document so
 * it can never interfere with draw, ranking or final-match data.
 *
 * Everything here is pure so the timing rules can be tested without Firestore.
 *
 * Backward compatible: when the document does not exist yet (an older
 * tournament), submission is treated as DISABLED and no timer is shown, which is
 * the safe default.
 */

export const CONTROL_DOC_PATH = 'tournamentSettings/tournament_control';

export type TournamentControlState = {
  /** Gates score inputs and submit buttons for players. */
  scoreSubmissionEnabled: boolean;
  /** True once the tournament clock has been started. */
  tournamentStarted: boolean;
  /** Epoch ms when the clock started, or null. */
  tournamentStartTime: number | null;
  /** Epoch ms when the clock froze, or null while still running. */
  tournamentEndTime: number | null;
};

/** Safe defaults: nothing enabled, no timer. */
export const DEFAULT_CONTROL_STATE: TournamentControlState = {
  scoreSubmissionEnabled: false,
  tournamentStarted: false,
  tournamentStartTime: null,
  tournamentEndTime: null,
};

const toMillis = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  // Firestore Timestamp (has toMillis) or an ISO string.
  const candidate = value as { toMillis?: () => number };
  if (typeof candidate.toMillis === 'function') {
    const ms = candidate.toMillis();
    return Number.isFinite(ms) ? ms : null;
  }
  if (typeof value === 'string') {
    const ms = Date.parse(value);
    return Number.isFinite(ms) ? ms : null;
  }
  return null;
};

/**
 * Coerce whatever is in Firestore into a valid state. Anything missing or
 * malformed falls back to the safe default, so a partially written document can
 * never enable submission by accident.
 */
export const normalizeControlState = (raw: unknown): TournamentControlState => {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_CONTROL_STATE };
  const data = raw as Record<string, unknown>;
  const startTime = toMillis(data.tournamentStartTime);
  const endTime = toMillis(data.tournamentEndTime);
  return {
    scoreSubmissionEnabled: data.scoreSubmissionEnabled === true,
    tournamentStarted: data.tournamentStarted === true || startTime !== null,
    tournamentStartTime: startTime,
    tournamentEndTime: endTime,
  };
};

const pad2 = (n: number) => String(n).padStart(2, '0');

/**
 * Format an elapsed duration as HH:MM. Hours are not wrapped at 24 so a long
 * tournament keeps counting up. Returns '--:--' when there is nothing to show.
 */
export const formatDuration = (elapsedMs: number | null): string => {
  if (elapsedMs === null || !Number.isFinite(elapsedMs) || elapsedMs < 0) return '--:--';
  const totalSeconds = Math.floor(elapsedMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return `${pad2(hours)}:${pad2(minutes)}`;
};

/**
 * Milliseconds shown by the timer, or null when the tournament has not started.
 * Once an end time exists the value is frozen, so every device shows the same
 * final duration regardless of when the page was opened.
 */
export const elapsedMs = (state: TournamentControlState, nowMs: number): number | null => {
  if (state.tournamentStartTime === null) return null;
  const end = state.tournamentEndTime;
  if (end !== null) return Math.max(0, end - state.tournamentStartTime);
  return Math.max(0, nowMs - state.tournamentStartTime);
};

/** True while the clock is counting. */
export const isTimerRunning = (state: TournamentControlState): boolean =>
  state.tournamentStartTime !== null && state.tournamentEndTime === null;

/** Format the current timer reading. */
export const formatElapsed = (state: TournamentControlState, nowMs: number): string =>
  formatDuration(elapsedMs(state, nowMs));