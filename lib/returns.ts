import { addDays, addMonths, daysBetween, previousYearEnd } from "./dates";
import type { NavPoint } from "./mfapi";

export type Returns = { wow: number | null; mom: number | null; ytd: number | null };

/**
 * Latest NAV on or before `date` (handles weekends/holidays).
 * `series` must be sorted ascending. Returns null if the nearest NAV is more than `maxLagDays` older.
 */
export function getNavOnOrBefore(series: NavPoint[], date: string, maxLagDays = 10): NavPoint | null {
  let lo = 0;
  let hi = series.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (series[mid].date <= date) {
      found = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  if (found < 0) return null;
  const point = series[found];
  return daysBetween(point.date, date) <= maxLagDays ? point : null;
}

export function pctChange(current: number, past: number): number {
  return (current / past - 1) * 100;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** WoW = vs 7 days ago, MoM = vs 1 month ago, YTD = vs last NAV of previous December. */
export function computeReturns(series: NavPoint[], asOf: string): Returns {
  const current = getNavOnOrBefore(series, asOf);
  if (!current) return { wow: null, mom: null, ytd: null };
  const calc = (past: NavPoint | null) => (past ? round2(pctChange(current.nav, past.nav)) : null);
  return {
    wow: calc(getNavOnOrBefore(series, addDays(asOf, -7))),
    mom: calc(getNavOnOrBefore(series, addMonths(asOf, -1))),
    ytd: calc(getNavOnOrBefore(series, previousYearEnd(asOf), 31)),
  };
}

/** Average of non-null values, rounded to 2 dp. */
export function average(values: (number | null)[]): number | null {
  const nums = values.filter((v): v is number => v !== null && Number.isFinite(v));
  if (nums.length === 0) return null;
  return round2(nums.reduce((a, b) => a + b, 0) / nums.length);
}
