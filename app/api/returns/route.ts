import { NextResponse } from "next/server";
import { addDays, addMonths, todayIST } from "@/lib/dates";
import { listFunds } from "@/lib/funds";
import { errorMessage } from "@/lib/http";
import type { NavPoint } from "@/lib/mfapi";
import { loadSeries } from "@/lib/nav";
import { average, changeBetween } from "@/lib/returns";

export const dynamic = "force-dynamic";

const FIRST_YEAR = 2021;

type Trio = { fund: number | null; index: number | null; cat: number | null };

/**
 * GET /api/returns?year=2025
 * Per fund: the chosen calendar year's return (or year-to-date for the current year) and the
 * trailing 1-year return, each for the fund, its index proxy and the similar-funds average.
 */
export async function GET(req: Request) {
  const today = todayIST();
  const currentYear = Number(today.slice(0, 4));
  const year = Number(new URL(req.url).searchParams.get("year") ?? currentYear);
  if (!Number.isInteger(year) || year < FIRST_YEAR || year > currentYear) {
    return NextResponse.json({ error: `year must be between ${FIRST_YEAR} and ${currentYear}` }, { status: 400 });
  }

  try {
    const funds = await listFunds();
    const codes = funds.flatMap((f) => [f.scheme_code, ...(f.peer_codes ?? []), ...(f.benchmark_code ? [f.benchmark_code] : [])]);
    const isCurrent = year === currentYear;
    const [calSeries, recent] = await Promise.all([
      loadSeries(codes, `${year - 1}-12-10`, isCurrent ? undefined : `${year}-12-31`),
      loadSeries(codes, addDays(addMonths(today, -12), -20)),
    ]);
    const get = (m: Map<number, NavPoint[]>, c: number) => m.get(c) ?? [];

    const result: Record<number, { calendar: Trio; one_year: Trio }> = {};
    for (const f of funds) {
      // Measure everything up to the fund's latest price so fund, index and peers cover the same days.
      const latest = get(recent, f.scheme_code).at(-1)?.date ?? today;
      const calEnd = isCurrent ? latest : `${year}-12-31`;
      const calStart = `${year - 1}-12-31`;
      const yearAgo = addMonths(latest, -12);

      const cal = (c: number) => changeBetween(get(calSeries, c), calStart, calEnd);
      const oneY = (c: number) => changeBetween(get(recent, c), yearAgo, latest);
      const peers = f.peer_codes ?? [];
      result[f.scheme_code] = {
        calendar: {
          fund: cal(f.scheme_code),
          index: f.benchmark_code ? cal(f.benchmark_code) : null,
          cat: average(peers.map(cal)),
        },
        one_year: {
          fund: oneY(f.scheme_code),
          index: f.benchmark_code ? oneY(f.benchmark_code) : null,
          cat: average(peers.map(oneY)),
        },
      };
    }

    const years = Array.from({ length: currentYear - FIRST_YEAR + 1 }, (_, i) => currentYear - i);
    return NextResponse.json({ year, current_year: currentYear, years, funds: result });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}
