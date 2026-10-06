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

/* ------------------------------------------------------------------------ *
 * Archived history
 *
 * Separated from `TournamentControlState` on purpose: the live timer must keep
 * working exactly as before, so history is parsed by its own function and is
 * never consulted by `elapsedMs`, `isTimerRunning`, `formatElapsed` or
 * `normalizeControlState`. A malformed history array can therefore only make
 * rows disappear from the admin table - it can never change a timer reading or
 * enable score submission.
 * ------------------------------------------------------------------------ */

/** One completed tournament clock, archived when the admin clears it. */
export type TournamentHistoryEntry = {
  /** Epoch ms when the clock started. */
  startedAt: number;
  /** Epoch ms when the clock froze, or null if it was still running. */
  endedAt: number | null;
  /** Final duration in ms, so the row never needs to re-derive it. */
  durationMs: number;
  /** Epoch ms when this entry was archived (the reset press). */
  archivedAt: number;
};

/**
 * Hard cap on archived rows. Keeps `tournament_control` well under the 1MB
 * document limit no matter how many tournaments run: at ~100 bytes a row,
 * 50 rows is ~5KB. Oldest rows are dropped first.
 */
export const MAX_HISTORY_ENTRIES = 50;

/**
 * Parse whatever is in the `history` array into well-formed entries.
 *
 * Defensive by design: a missing array yields `[]`, entries with an unusable
 * start time or duration are skipped rather than coerced, and the list is
 * capped. Nothing here can throw.
 */
export const normalizeHistory = (raw: unknown): TournamentHistoryEntry[] => {
  if (!Array.isArray(raw)) return [];

  const entries: TournamentHistoryEntry[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const data = item as Record<string, unknown>;

    const startedAt = toMillis(data.startedAt);
    const durationMs = toMillis(data.durationMs);
    // A duration has no usable value unless it is a finite, non-negative number.
    if (startedAt === null || durationMs === null || durationMs < 0) continue;

    entries.push({
      startedAt,
      endedAt: toMillis(data.endedAt),
      durationMs,
      archivedAt: toMillis(data.archivedAt) ?? startedAt,
    });
  }

  // Keep chronological order stable, then cap.
  entries.sort((a, b) => a.startedAt - b.startedAt);
  return entries.slice(-MAX_HISTORY_ENTRIES);
};

/**
 * Build the row to archive for the current clock, or null when there is nothing
 * worth recording (the clock was never started).
 *
 * An end time of null means the clock was still running when it was cleared;
 * the elapsed reading at that moment becomes the duration.
 */
export const buildHistoryEntry = (
  state: TournamentControlState,
  nowMs: number
): TournamentHistoryEntry | null => {
  if (state.tournamentStartTime === null) return null;
  const endedAt = state.tournamentEndTime;
  const endMs = endedAt ?? nowMs;
  if (!Number.isFinite(endMs)) return null;

  const durationMs = Math.max(0, endMs - state.tournamentStartTime);
  return {
    startedAt: state.tournamentStartTime,
    endedAt,
    durationMs,
    archivedAt: nowMs,
  };
};

/**
 * Append an entry, newest last, dropping the oldest rows beyond the cap.
 * Passing null leaves the list unchanged, so a clock that was never started
 * never writes history at all.
 */
export const appendHistory = (
  existing: TournamentHistoryEntry[],
  entry: TournamentHistoryEntry | null
): TournamentHistoryEntry[] => {
  if (!entry) return existing;
  return [...existing, entry].slice(-MAX_HISTORY_ENTRIES);
};