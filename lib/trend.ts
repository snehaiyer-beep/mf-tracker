import { addDays, addMonths, lastFridayOnOrBefore } from "./dates";
import type { NavPoint } from "./mfapi";
import { average, getNavOnOrBefore } from "./returns";

export type TrendRange = "week" | "month" | "year";
export type TrendPoint = { date: string; fund: number | null; index: number | null; cat: number | null };
/** One bar group: the return over a single week or month. */
export type PeriodBar = { label: string; start: string; end: string; partial: boolean } & Omit<TrendPoint, "date">;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const PERIODS = 12;

/** % change between the NAVs on (or just before) two dates. */
function change(series: NavPoint[], from: string, to: string): number | null {
  const base = getNavOnOrBefore(series, from);
  const now = getNavOnOrBefore(series, to);
  if (!base || !now || base.date === now.date) return null;
  return Math.round((now.nav / base.nav - 1) * 10000) / 100;
}

/** Year view: growth since a year ago, one point per week; every line starts at 0%. */
export function computeYearLine(
  fund: NavPoint[],
  index: NavPoint[] | null,
  peers: NavPoint[][],
): { start: string; end: string; points: TrendPoint[] } {
  const end = fund.at(-1)?.date;
  if (!end) return { start: "", end: "", points: [] };
  const start = getNavOnOrBefore(fund, addMonths(end, -12))?.date ?? addMonths(end, -12);
  const all = fund.filter((p) => p.date >= start).map((p) => p.date);
  const dates = all.filter((_, i) => i % 5 === 0 || i === all.length - 1);
  const growth = (s: NavPoint[], d: string) => (d === start ? 0 : change(s, start, d));
  const points = dates.map((date) => ({
    date,
    fund: growth(fund, date),
    index: index ? growth(index, date) : null,
    cat: average(peers.map((p) => growth(p, date))),
  }));
  return { start, end, points };
}

function lastDayOfMonth(year: number, month: number): string {
  return new Date(Date.UTC(year, month + 1, 0)).toISOString().slice(0, 10);
}

/**
 * Week / month view: how much each of the last 12 weeks (Friday to Friday) or calendar months
 * went up or down. A still-running week or month is included and flagged as partial.
 */
export function computePeriodBars(
  fund: NavPoint[],
  index: NavPoint[] | null,
  peers: NavPoint[][],
  range: "week" | "month",
): PeriodBar[] {
  const latest = fund.at(-1)?.date;
  if (!latest) return [];
  const spans: { start: string; end: string; label: string; partial: boolean }[] = [];

  if (range === "week") {
    const lastFri = lastFridayOnOrBefore(latest);
    const partial = latest > lastFri;
    const ends = Array.from({ length: PERIODS }, (_, i) => addDays(lastFri, -7 * (PERIODS - 1 - i)));
    if (partial) ends.push(latest);
    for (const end of ends.slice(-PERIODS)) {
      const isPartial = end === latest && partial;
      const start = isPartial ? lastFri : addDays(end, -7);
      const d = new Date(`${end}T00:00:00Z`);
      spans.push({ start, end, partial: isPartial, label: `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}` });
    }
  } else {
    const y = Number(latest.slice(0, 4));
    const m = Number(latest.slice(5, 7)) - 1;
    for (let i = PERIODS - 1; i >= 0; i--) {
      const dt = new Date(Date.UTC(y, m - i, 1));
      const year = dt.getUTCFullYear();
      const month = dt.getUTCMonth();
      const monthEnd = lastDayOfMonth(year, month);
      const partial = monthEnd > latest;
      spans.push({
        start: lastDayOfMonth(year, month - 1),
        end: partial ? latest : monthEnd,
        partial,
        label: `${MONTHS[month]}${month === 0 || i === PERIODS - 1 ? ` '${String(year).slice(2)}` : ""}`,
      });
    }
  }

  return spans.map((s) => ({
    ...s,
    fund: change(fund, s.start, s.end),
    index: index ? change(index, s.start, s.end) : null,
    cat: average(peers.map((p) => change(p, s.start, s.end))),
  }));
}
