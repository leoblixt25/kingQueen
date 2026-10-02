/**
 * Draw scheduling helpers.
 *
 * The draw happens on the day BEFORE the tournament, at a configurable time
 * that is always interpreted as BARCELONA local time (Europe/Madrid), so every
 * player sees the same wall-clock hour regardless of where their phone is.
 *
 * Europe/Madrid is UTC+2 in summer (CEST) and UTC+1 in winter (CET), so the
 * offset is resolved per-date with Intl instead of a hardcoded number.
 */

export const DRAW_TIME_ZONE = 'Europe/Madrid';
export const DEFAULT_DRAW_TIME = '21:00';

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;
const YMD = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Offset in ms to ADD to a UTC instant to get wall-clock time in `timeZone`. */
const zoneOffsetMs = (utcDate: Date, timeZone: string): number => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(utcDate);

  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour') % 24,
    get('minute'),
    get('second')
  );
  return asUtc - utcDate.getTime();
};

/**
 * Convert a wall-clock date+time in `timeZone` to a UTC timestamp.
 * Two passes so dates near a DST switch resolve to the correct offset.
 */
export const zonedTimeToTimestamp = (
  dateStr: string,
  timeStr: string,
  timeZone: string = DRAW_TIME_ZONE
): number | null => {
  const d = YMD.exec(dateStr);
  const t = HHMM.exec(timeStr);
  if (!d || !t) return null;

  const naive = Date.UTC(Number(d[1]), Number(d[2]) - 1, Number(d[3]), Number(t[1]), Number(t[2]), 0);
  const firstPass = naive - zoneOffsetMs(new Date(naive), timeZone);
  // Re-resolve at the candidate instant; DST can change the offset itself.
  return naive - zoneOffsetMs(new Date(firstPass), timeZone);
};

/** The calendar date one day before `dateStr`, as 'YYYY-MM-DD'. */
const previousDay = (dateStr: string): string => {
  const d = YMD.exec(dateStr);
  if (!d) return dateStr;
  const shifted = new Date(Date.UTC(Number(d[1]), Number(d[2]) - 1, Number(d[3]) - 1));
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
};

/**
 * Timestamp of the draw: `drawTime` (Barcelona time) on the day before the
 * tournament. Falls back to 21:00 when no time is configured yet, and returns
 * null when there is no usable tournament date.
 */
export const getDrawTimestamp = (
  tournamentDate?: string | null,
  drawTime?: string | null
): number | null => {
  if (!tournamentDate) return null;
  const time = drawTime && HHMM.test(drawTime) ? drawTime : DEFAULT_DRAW_TIME;
  return zonedTimeToTimestamp(previousDay(tournamentDate), time, DRAW_TIME_ZONE);
};