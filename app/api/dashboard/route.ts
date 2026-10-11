import { NextResponse } from "next/server";
import { ALL_BENCHMARKS } from "@/lib/benchmarks";
import { addDays, addMonths, previousYearEnd, todayIST } from "@/lib/dates";
import { listFunds } from "@/lib/funds";
import { errorMessage } from "@/lib/http";
import type { NavPoint } from "@/lib/mfapi";
import { loadSeries } from "@/lib/nav";
import { computeReturns } from "@/lib/returns";
import { db, type Snapshot } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const SPARK_DAYS = 90;

/** Last ~90 days of NAVs, thinned to ~45 points, for small inline trend lines. */
function spark(series: NavPoint[], today: string): number[] {
  const recent = series.filter((p) => p.date >= addDays(today, -SPARK_DAYS));
  const step = Math.max(1, Math.ceil(recent.length / 45));
  return recent.filter((_, i) => i % step === 0 || i === recent.length - 1).map((p) => p.nav);
}

/** Everything the dashboard needs in one call. */
export async function GET() {
  try {
    const today = todayIST();
    const funds = await listFunds();
    const since = addDays([previousYearEnd(today), addMonths(today, -1)].sort()[0], -40);

    const [snaps, reports, series] = await Promise.all([
      db()
        .from("weekly_snapshots")
        .select("*")
        .gte("week_ending", addDays(today, -400))
        .order("week_ending", { ascending: true })
        .limit(1000),
      db()
        .from("reports")
        .select("id, week_ending, verdict, report, email_sent, created_at")
        .order("week_ending", { ascending: false })
        .limit(20),
      loadSeries([...funds.map((f) => f.scheme_code), ...ALL_BENCHMARKS.map((b) => b.code)], since),
    ]);
    if (snaps.error) throw new Error(snaps.error.message);
    if (reports.error) throw new Error(reports.error.message);

    // Postgres numeric comes back as strings; the chart needs real numbers.
    const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
    const snapshots: Snapshot[] = (snaps.data ?? []).map((r) => ({
      week_ending: String(r.week_ending),
      scheme_code: Number(r.scheme_code),
      wow: num(r.wow), mom: num(r.mom), ytd: num(r.ytd),
      bench_wow: num(r.bench_wow), bench_mom: num(r.bench_mom), bench_ytd: num(r.bench_ytd),
      cat_wow: num(r.cat_wow), cat_mom: num(r.cat_mom), cat_ytd: num(r.cat_ytd),
    }));
    const latest: Record<number, Snapshot> = {};
    for (const s of snapshots) latest[s.scheme_code] = s; // ascending, so last wins

    const indices = ALL_BENCHMARKS.map((b) => {
      const s = series.get(b.code) ?? [];
      return { name: b.name, ...computeReturns(s, today), spark: spark(s, today), as_of: s.at(-1)?.date ?? null };
    });
    const sparks: Record<number, number[]> = {};
    for (const f of funds) sparks[f.scheme_code] = spark(series.get(f.scheme_code) ?? [], today);

    return NextResponse.json({ funds, snapshots, latest, reports: reports.data ?? [], indices, sparks });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}
