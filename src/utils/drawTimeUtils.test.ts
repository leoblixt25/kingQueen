import { describe, it, expect } from 'vitest';
import { getDrawTimestamp, zonedTimeToTimestamp, DEFAULT_DRAW_TIME } from './drawTimeUtils';

const isoInBarcelona = (ts: number) =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Madrid',
    dateStyle: 'short',
    timeStyle: 'short',
    hour12: false,
  }).format(ts);

describe('zonedTimeToTimestamp', () => {
  it('resolves summer time (CEST, UTC+2)', () => {
    const ts = zonedTimeToTimestamp('2026-08-15', '20:00')!;
    expect(new Date(ts).toISOString()).toBe('2026-08-15T18:00:00.000Z');
    expect(isoInBarcelona(ts)).toContain('20:00');
  });

  it('resolves winter time (CET, UTC+1)', () => {
    const ts = zonedTimeToTimestamp('2026-01-15', '20:00')!;
    expect(new Date(ts).toISOString()).toBe('2026-01-15T19:00:00.000Z');
    expect(isoInBarcelona(ts)).toContain('20:00');
  });

  it('returns null for malformed input', () => {
    expect(zonedTimeToTimestamp('15-08-2026', '20:00')).toBeNull();
    expect(zonedTimeToTimestamp('2026-08-15', '25:00')).toBeNull();
    expect(zonedTimeToTimestamp('2026-08-15', '8pm')).toBeNull();
  });
});

describe('getDrawTimestamp', () => {
  it('counts back one day from the tournament date', () => {
    const ts = getDrawTimestamp('2026-08-16', '20:00')!;
    expect(new Date(ts).toISOString()).toBe('2026-08-15T18:00:00.000Z');
  });

  it('handles a month boundary when going back one day', () => {
    const ts = getDrawTimestamp('2026-09-01', '20:00')!;
    expect(isoInBarcelona(ts)).toContain('31/08/2026');
    expect(isoInBarcelona(ts)).toContain('20:00');
  });

  it('handles a year boundary when going back one day', () => {
    const ts = getDrawTimestamp('2026-01-01', '20:00')!;
    expect(isoInBarcelona(ts)).toContain('31/12/2025');
  });

  it('falls back to 21:00 when no draw time is configured', () => {
    const withoutTime = getDrawTimestamp('2026-08-16')!;
    const explicitDefault = getDrawTimestamp('2026-08-16', DEFAULT_DRAW_TIME)!;
    expect(withoutTime).toBe(explicitDefault);
    expect(isoInBarcelona(withoutTime)).toContain('21:00');
  });

  it('ignores an invalid configured time and uses the default', () => {
    expect(getDrawTimestamp('2026-08-16', 'not-a-time')).toBe(
      getDrawTimestamp('2026-08-16', DEFAULT_DRAW_TIME)
    );
  });

  it('returns null without a tournament date', () => {
    expect(getDrawTimestamp(undefined)).toBeNull();
    expect(getDrawTimestamp('')).toBeNull();
  });

  it('keeps the configured wall-clock hour on both sides of DST', () => {
    // Tournament in August (CEST) and December (CET) must both read 20:00 local.
    expect(isoInBarcelona(getDrawTimestamp('2026-08-16', '20:00')!)).toContain('20:00');
    expect(isoInBarcelona(getDrawTimestamp('2026-12-16', '20:00')!)).toContain('20:00');
  });
});