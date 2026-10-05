import { describe, it, expect } from 'vitest';
import {
  DEFAULT_CONTROL_STATE,
  elapsedMs,
  formatDuration,
  formatElapsed,
  isTimerRunning,
  normalizeControlState,
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