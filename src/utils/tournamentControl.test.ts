import { describe, it, expect } from 'vitest';
import {
  DEFAULT_CONTROL_STATE,
  MAX_HISTORY_ENTRIES,
  appendHistory,
  buildHistoryEntry,
  elapsedMs,
  formatDuration,
  formatElapsed,
  isTimerRunning,
  normalizeControlState,
  normalizeHistory,
  type TournamentHistoryEntry,
} from './tournamentControl';

const ts = (ms: number) => ({ toMillis: () => ms });

describe('normalizeControlState', () => {
  it('treats a missing document as disabled with no timer', () => {
    expect(normalizeControlState(null)).toEqual(DEFAULT_CONTROL_STATE);
    expect(normalizeControlState(undefined)).toEqual(DEFAULT_CONTROL_STATE);
    expect(normalizeControlState(null).scoreSubmissionEnabled).toBe(false);
  });

  it('reads Firestore Timestamps', () => {
    const state = normalizeControlState({
      scoreSubmissionEnabled: true,
      tournamentStarted: true,
      tournamentStartTime: ts(1_000),
      tournamentEndTime: ts(61_000),
    });
    expect(state.tournamentStartTime).toBe(1000);
    expect(state.tournamentEndTime).toBe(61_000);
  });

  it('reads ISO strings and raw numbers', () => {
    const iso = '2026-10-03T08:00:00.000Z';
    expect(normalizeControlState({ tournamentStartTime: iso }).tournamentStartTime).toBe(
      Date.parse(iso)
    );
    expect(normalizeControlState({ tournamentStartTime: 5000 }).tournamentStartTime).toBe(5000);
  });

  it('only enables submission on a strict boolean true', () => {
    expect(normalizeControlState({ scoreSubmissionEnabled: 'true' }).scoreSubmissionEnabled).toBe(false);
    expect(normalizeControlState({ scoreSubmissionEnabled: 1 }).scoreSubmissionEnabled).toBe(false);
    expect(normalizeControlState({ scoreSubmissionEnabled: true }).scoreSubmissionEnabled).toBe(true);
  });

  it('infers started when a start time exists', () => {
    expect(normalizeControlState({ tournamentStartTime: 1000 }).tournamentStarted).toBe(true);
  });

  it('survives malformed values without enabling submission', () => {
    const state = normalizeControlState({
      scoreSubmissionEnabled: true,
      tournamentStartTime: { toMillis: () => NaN },
      tournamentEndTime: 'not-a-date',
    });
    expect(state.scoreSubmissionEnabled).toBe(true);
    expect(state.tournamentStartTime).toBeNull();
    expect(state.tournamentEndTime).toBeNull();
  });
});

describe('formatDuration', () => {
  it('formats HH:MM as specified', () => {
    expect(formatDuration(84 * 60 * 1000)).toBe('01:24');
    expect(formatDuration(173 * 60 * 1000)).toBe('02:53');
    expect(formatDuration((3 * 3600 + 37 * 60) * 1000)).toBe('03:37');
  });

  it('pads and does not wrap at 24 hours', () => {
    expect(formatDuration(0)).toBe('00:00');
    expect(formatDuration(9 * 60 * 1000)).toBe('00:09');
    expect(formatDuration(25 * 3600 * 1000)).toBe('25:00');
  });

  it('truncates seconds rather than rounding up', () => {
    // 1m59.999s -> 00:01 (must not round up to 00:02)
    expect(formatDuration(119_999)).toBe('00:01');
    // 1h58m59.999s -> 01:58 (must not round up to 01:59)
    expect(formatDuration(7_139_999)).toBe('01:58');
  });

  it('returns a placeholder when there is nothing to show', () => {
    expect(formatDuration(null)).toBe('--:--');
    expect(formatDuration(-1)).toBe('--:--');
    expect(formatDuration(NaN)).toBe('--:--');
  });
});

describe('elapsedMs', () => {
  const started = { ...DEFAULT_CONTROL_STATE, tournamentStarted: true, tournamentStartTime: 1_000 };

  it('is null before the tournament starts', () => {
    expect(elapsedMs(DEFAULT_CONTROL_STATE, 999_999)).toBeNull();
  });

  it('counts up in real time while running', () => {
    expect(elapsedMs(started, 61_000)).toBe(60_000);
  });

  it('freezes at the recorded duration once finished', () => {
    const finished = { ...started, tournamentEndTime: 3_061_000 };
    // Same answer no matter how far past the end "now" is.
    expect(elapsedMs(finished, 3_061_000)).toBe(3_060_000);
    expect(elapsedMs(finished, 99_999_999)).toBe(3_060_000);
  });

  it('never goes negative', () => {
    expect(elapsedMs({ ...started, tournamentEndTime: 500 }, 9_999)).toBe(0);
    expect(elapsedMs(started, 0)).toBe(0);
  });
});

describe('isTimerRunning', () => {
  it('is running only when started and not finished', () => {
    expect(isTimerRunning({ ...DEFAULT_CONTROL_STATE })).toBe(false);
    expect(isTimerRunning({ ...DEFAULT_CONTROL_STATE, tournamentStartTime: 1 })).toBe(true);
    expect(
      isTimerRunning({ ...DEFAULT_CONTROL_STATE, tournamentStartTime: 1, tournamentEndTime: 2 })
    ).toBe(false);
  });
});

describe('formatElapsed', () => {
  it('formats a running timer', () => {
    expect(
      formatElapsed({ ...DEFAULT_CONTROL_STATE, tournamentStartTime: 0 }, 84 * 60 * 1000)
    ).toBe('01:24');
  });

  it('formats the frozen duration after the final', () => {
    const state = {
      ...DEFAULT_CONTROL_STATE,
      tournamentStartTime: 0,
      tournamentEndTime: (3 * 3600 + 37 * 60) * 1000,
    };
    expect(formatElapsed(state, 10_000_000)).toBe('03:37');
    expect(formatElapsed(state, 20_000_000)).toBe('03:37');
  });

  it('shows the placeholder before the tournament starts', () => {
    expect(formatElapsed(DEFAULT_CONTROL_STATE, 5_000_000)).toBe('--:--');
  });
});

describe('history does not affect the timer', () => {
  it('normalizeControlState ignores history entirely', () => {
    const withHistory = normalizeControlState({ tournamentStartTime: 1_000, history: 'garbage' });
    const withoutHistory = normalizeControlState({ tournamentStartTime: 1_000 });
    expect(withHistory).toEqual(withoutHistory);
    expect(withHistory).toEqual(normalizeControlState(withoutHistory));
  });

  it('a malformed history array never changes elapsed time or submission state', () => {
    const state = normalizeControlState({ scoreSubmissionEnabled: true, tournamentStartTime: 1_000 });
    expect(elapsedMs(state, 61_000)).toBe(60_000);
    expect(state.scoreSubmissionEnabled).toBe(true);
    // The same input still parses safely through the history reader.
    expect(normalizeHistory([null, 7, 'x', {}, { startedAt: 'bad' }])).toEqual([]);
  });
});

describe('buildHistoryEntry', () => {
  it('records nothing when the clock never started', () => {
    expect(buildHistoryEntry(DEFAULT_CONTROL_STATE, 999_999)).toBeNull();
  });

  it('uses the frozen end time for a finished tournament', () => {
    const entry = buildHistoryEntry(
      { ...DEFAULT_CONTROL_STATE, tournamentStartTime: 1_000, tournamentEndTime: 61_000 },
      500_000
    );
    expect(entry).toEqual({
      startedAt: 1_000,
      endedAt: 61_000,
      durationMs: 60_000,
      archivedAt: 500_000,
    });
  });

  it('captures the running reading when a still-running clock is cleared', () => {
    const entry = buildHistoryEntry(
      { ...DEFAULT_CONTROL_STATE, tournamentStartTime: 1_000 },
      121_000
    );
    expect(entry).toMatchObject({ startedAt: 1_000, endedAt: null, durationMs: 120_000 });
  });

  it('never records a negative duration', () => {
    const entry = buildHistoryEntry(
      { ...DEFAULT_CONTROL_STATE, tournamentStartTime: 10_000, tournamentEndTime: 1_000 },
      5_000
    );
    expect(entry?.durationMs).toBe(0);
  });
});

describe('normalizeHistory', () => {
  const entry = (startedAt: number): TournamentHistoryEntry => ({
    startedAt,
    endedAt: startedAt + 60_000,
    durationMs: 60_000,
    archivedAt: startedAt + 60_000,
  });

  it('returns an empty list for anything that is not a usable array', () => {
    expect(normalizeHistory(undefined)).toEqual([]);
    expect(normalizeHistory(null)).toEqual([]);
    expect(normalizeHistory('history')).toEqual([]);
    expect(normalizeHistory({})).toEqual([]);
    expect(normalizeHistory([null, 3, 'x'])).toEqual([]);
  });

  it('reads Firestore Timestamps inside entries', () => {
    expect(
      normalizeHistory([
        { startedAt: ts(1_000), endedAt: ts(61_000), durationMs: 60_000, archivedAt: ts(61_000) },
      ])
    ).toEqual([{ startedAt: 1_000, endedAt: 61_000, durationMs: 60_000, archivedAt: 61_000 }]);
  });

  it('drops entries without a usable start time or duration', () => {
    expect(normalizeHistory([{ startedAt: 'bad', durationMs: 1 }])).toEqual([]);
    expect(normalizeHistory([{ durationMs: 1 }])).toEqual([]);
    expect(normalizeHistory([{ startedAt: 1_000, durationMs: -5 }])).toEqual([]);
    expect(normalizeHistory([{ startedAt: 1_000, durationMs: NaN }])).toEqual([]);
    expect(normalizeHistory([{ startedAt: 1_000, durationMs: '1h' }])).toEqual([]);
  });

  it('keeps order stable and caps at the limit, dropping the oldest', () => {
    const rows = Array.from({ length: MAX_HISTORY_ENTRIES + 5 }, (_, i) => entry(i * 1_000));
    const shuffled = [...rows].reverse();
    const parsed = normalizeHistory(shuffled);
    expect(parsed).toHaveLength(MAX_HISTORY_ENTRIES);
    // Oldest 5 dropped, order restored chronologically.
    expect(parsed[0].startedAt).toBe(5_000);
    expect(parsed.at(-1)?.startedAt).toBe((MAX_HISTORY_ENTRIES + 4) * 1_000);
  });

  it('defaults a missing archivedAt to the start time', () => {
    expect(normalizeHistory([{ startedAt: 1_000, durationMs: 500 }])).toEqual([
      { startedAt: 1_000, endedAt: null, durationMs: 500, archivedAt: 1_000 },
    ]);
  });
});

describe('appendHistory', () => {
  const entry = (startedAt: number): TournamentHistoryEntry => ({
    startedAt,
    endedAt: null,
    durationMs: 1,
    archivedAt: startedAt,
  });

  it('leaves the list untouched when there is nothing to archive', () => {
    const existing = [entry(1_000)];
    expect(appendHistory(existing, null)).toBe(existing);
    expect(appendHistory([], null)).toEqual([]);
  });

  it('appends newest last and drops the oldest beyond the cap', () => {
    const existing = Array.from({ length: MAX_HISTORY_ENTRIES }, (_, i) => entry(i * 1_000));
    const next = appendHistory(existing, entry(MAX_HISTORY_ENTRIES * 1_000));
    expect(next).toHaveLength(MAX_HISTORY_ENTRIES);
    expect(next.at(-1)?.startedAt).toBe(MAX_HISTORY_ENTRIES * 1_000);
    expect(next[0].startedAt).toBe(1_000);
  });
});