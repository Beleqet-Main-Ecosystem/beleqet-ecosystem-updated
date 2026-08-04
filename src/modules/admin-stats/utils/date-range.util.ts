import { BadRequestException } from '@nestjs/common';
import {
  ResolvedStatsRange,
  StatsGranularity,
  StatsRangePreset,
} from '../types/admin-stats.types';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_SPAN_DAYS = 366;

export interface RangeQueryInput {
  range?: StatsRangePreset;
  from?: string;
  to?: string;
  tz?: string;
}

/** Formats a Date as YYYY-MM-DD in the given IANA timezone. */
export function formatDateInTz(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/** Formats a Date as YYYY-MM in the given IANA timezone. */
export function formatMonthInTz(date: Date, timeZone: string): string {
  return formatDateInTz(date, timeZone).slice(0, 7);
}

/**
 * Converts a calendar date + wall-clock time in `timeZone` to a UTC Date.
 */
export function zonedDateTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  timeZone: string,
): Date {
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  const asTz = new Date(utcGuess.toLocaleString('en-US', { timeZone }));
  const asUtc = new Date(utcGuess.toLocaleString('en-US', { timeZone: 'UTC' }));
  const offset = asUtc.getTime() - asTz.getTime();
  return new Date(utcGuess.getTime() + offset);
}

function parseYmd(value: string): { y: number; m: number; d: number } {
  if (!DATE_RE.test(value)) {
    throw new BadRequestException('from/to must be YYYY-MM-DD');
  }
  const [y, m, d] = value.split('-').map(Number);
  return { y, m, d };
}

export function startOfZonedDay(ymd: string, timeZone: string): Date {
  const { y, m, d } = parseYmd(ymd);
  return zonedDateTimeToUtc(y, m, d, 0, 0, 0, timeZone);
}

export function endOfZonedDay(ymd: string, timeZone: string): Date {
  const { y, m, d } = parseYmd(ymd);
  return zonedDateTimeToUtc(y, m, d, 23, 59, 59, timeZone);
}

function addDaysYmd(ymd: string, days: number, timeZone: string): string {
  const start = startOfZonedDay(ymd, timeZone);
  const shifted = new Date(start.getTime() + days * 24 * 60 * 60 * 1000 + 12 * 60 * 60 * 1000);
  return formatDateInTz(shifted, timeZone);
}

function daysBetweenInclusive(from: string, to: string, timeZone: string): number {
  const a = startOfZonedDay(from, timeZone).getTime();
  const b = startOfZonedDay(to, timeZone).getTime();
  return Math.floor((b - a) / (24 * 60 * 60 * 1000)) + 1;
}

function chooseGranularity(preset: StatsRangePreset, from: string, to: string, tz: string): StatsGranularity {
  if (preset === '12m') return 'month';
  if (preset === 'custom') {
    return daysBetweenInclusive(from, to, tz) <= 45 ? 'day' : 'month';
  }
  return 'day';
}

/**
 * Resolves preset / custom date range into absolute UTC bounds and bucket granularity.
 */
export function resolveStatsRange(input: RangeQueryInput, now = new Date()): ResolvedStatsRange {
  const tz = input.tz || 'Africa/Addis_Ababa';
  const preset: StatsRangePreset = input.range || '30d';

  let from: string;
  let to: string;

  if (preset === 'custom') {
    if (!input.from || !input.to) {
      throw new BadRequestException('custom range requires from and to (YYYY-MM-DD)');
    }
    from = input.from;
    to = input.to;
  } else {
    to = formatDateInTz(now, tz);
    if (preset === '7d') from = addDaysYmd(to, -6, tz);
    else if (preset === '30d') from = addDaysYmd(to, -29, tz);
    else {
      // 12m: first day of month 11 months before current month
      const toMonth = formatMonthInTz(now, tz);
      const [ty, tm] = toMonth.split('-').map(Number);
      const start = new Date(Date.UTC(ty, tm - 1 - 11, 1));
      from = `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, '0')}-01`;
      // Clamp from to calendar first of that month in tz display terms
      from = formatDateInTz(startOfZonedDay(from, 'UTC'), tz);
      // Prefer explicit first-of-month string:
      const anchor = new Date(Date.UTC(ty, tm - 1 - 11, 15));
      from = `${anchor.getUTCFullYear()}-${String(anchor.getUTCMonth() + 1).padStart(2, '0')}-01`;
    }
  }

  if (from > to) {
    throw new BadRequestException('from must be less than or equal to to');
  }

  const span = daysBetweenInclusive(from, to, tz);
  if (span > MAX_SPAN_DAYS) {
    throw new BadRequestException(`Date range cannot exceed ${MAX_SPAN_DAYS} days`);
  }

  const granularity = chooseGranularity(preset, from, to, tz);

  return {
    preset,
    from,
    to,
    tz,
    fromDate: startOfZonedDay(from, tz),
    toDate: endOfZonedDay(to, tz),
    granularity,
  };
}

/** Calendar month bounds for "this month" relative to the range end date. */
export function monthBoundsForYmd(ymd: string, timeZone: string): { start: Date; end: Date; month: string } {
  const month = ymd.slice(0, 7);
  const [y, m] = month.split('-').map(Number);
  const startYmd = `${month}-01`;
  const nextMonth = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
  const lastDay = formatDateInTz(
    new Date(startOfZonedDay(nextMonth, timeZone).getTime() - 12 * 60 * 60 * 1000),
    timeZone,
  );
  return {
    month,
    start: startOfZonedDay(startYmd, timeZone),
    end: endOfZonedDay(lastDay, timeZone),
  };
}

export function previousMonthYmd(month: string): string {
  const [y, m] = month.split('-').map(Number);
  if (m === 1) return `${y - 1}-12`;
  return `${y}-${String(m - 1).padStart(2, '0')}`;
}

/** Zero-filled day keys from from..to inclusive. */
export function eachDayKey(from: string, to: string, timeZone: string): string[] {
  const keys: string[] = [];
  let cursor = from;
  while (cursor <= to) {
    keys.push(cursor);
    cursor = addDaysYmd(cursor, 1, timeZone);
  }
  return keys;
}

/** Zero-filled month keys (YYYY-MM) covering from..to. */
export function eachMonthKey(from: string, to: string): string[] {
  const keys: string[] = [];
  let [y, m] = from.slice(0, 7).split('-').map(Number);
  const [ey, em] = to.slice(0, 7).split('-').map(Number);
  while (y < ey || (y === ey && m <= em)) {
    keys.push(`${y}-${String(m).padStart(2, '0')}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return keys;
}

export function bucketKeyForDate(date: Date, granularity: StatsGranularity, timeZone: string): string {
  return granularity === 'month' ? formatMonthInTz(date, timeZone) : formatDateInTz(date, timeZone);
}
