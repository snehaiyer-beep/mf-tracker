import { addDays, addMonths } from "./dates";
import type { NavPoint } from "./mfapi";
import { average, getNavOnOrBefore } from "./returns";

export type TrendRange = "week" | "month" | "year";
export type TrendPoint = { date: string; fund: number | null; index: number | null; cat: number | null };

export function rangeStart(range: TrendRange, end: string): string {
  if (range === "week") return addDays(end, -7);
  if (range === "month") return addMonths(end, -1);
  return addMonths(end, -12);
}

/** % growth since the start of the range; every line starts at 0 so they are directly comparable. */
function growth(series: NavPoint[], start: string, date: string): number | null {
  const base = getNavOnOrBefore(series, start);
  const now = getNavOnOrBefore(series, date);
  if (!base || !now) return null;
  return Math.round((now.nav / base.nav - 1) * 10000) / 100;
}

/**
 * Daily points for the fund, its index and the similar-funds average over the chosen range.
 * The year view keeps one point per week so the chart stays readable.
 */
export function computeTrend(
  fund: NavPoint[],
  index: NavPoint[] | null,
  peers: NavPoint[][],
  range: TrendRange,
): { start: string; end: string; points: TrendPoint[] } {
  const end = fund.at(-1)?.date;
  if (!end) return { start: "", end: "", points: [] };
  const target = rangeStart(range, end);
  // Start on the last trading day on or before the target, so the first point is 0% and the
  // week view matches the "Week" return in the fund table.
  const start = getNavOnOrBefore(fund, target)?.date ?? target;
  let dates = fund.filter((p) => p.date >= start).map((p) => p.date);
  if (range === "year") dates = dates.filter((_, i) => i % 5 === 0 || i === dates.length - 1);

  const points = dates.map((date) => ({
    date,
    fund: growth(fund, start, date),
    index: index ? growth(index, start, date) : null,
    cat: average(peers.map((p) => growth(p, start, date))),
  }));
  return { start: points[0]?.date ?? start, end, points };
}
