import { MARKET_INDICES } from "./benchmarks";
import { addDays, addMonths, lastFridayOnOrBefore, previousYearEnd, todayIST } from "./dates";
import type { NavPoint } from "./mfapi";
import { loadSeries } from "./nav";
import { average, computeReturns } from "./returns";
import { db, type Fund, type Snapshot } from "./supabase";

/** Every scheme whose NAVs we need: funds, their peers, their benchmarks and the tracked indices. */
export function trackedCodes(funds: Fund[]): number[] {
  return [
    ...funds.map((f) => f.scheme_code),
    ...funds.flatMap((f) => f.peer_codes ?? []),
    ...funds.map((f) => f.benchmark_code).filter((c): c is number => c !== null),
    ...MARKET_INDICES.map((b) => b.code),
  ];
}

/** Earliest NAV date needed for returns as of `asOf` (YTD needs last December; MoM a month back). */
export function historyStart(asOf: string): string {
  return addDays([previousYearEnd(asOf), addMonths(asOf, -1)].sort()[0], -40);
}

/** Fund vs benchmark vs category-average returns for one week ending. */
export function computeSnapshots(funds: Fund[], asOf: string, series: Map<number, NavPoint[]>): Snapshot[] {
  const ret = (code: number) => computeReturns(series.get(code) ?? [], asOf);
  return funds.map((f) => {
    const own = ret(f.scheme_code);
    const bench = f.benchmark_code ? ret(f.benchmark_code) : { wow: null, mom: null, ytd: null };
    const peers = (f.peer_codes ?? []).map(ret);
    return {
      week_ending: asOf,
      scheme_code: f.scheme_code,
      wow: own.wow,
      mom: own.mom,
      ytd: own.ytd,
      bench_wow: bench.wow,
      bench_mom: bench.mom,
      bench_ytd: bench.ytd,
      cat_wow: average(peers.map((p) => p.wow)),
      cat_mom: average(peers.map((p) => p.mom)),
      cat_ytd: average(peers.map((p) => p.ytd)),
    };
  });
}

export async function saveSnapshots(snapshots: Snapshot[]): Promise<void> {
  for (let i = 0; i < snapshots.length; i += 500) {
    const { error } = await db()
      .from("weekly_snapshots")
      .upsert(snapshots.slice(i, i + 500), { onConflict: "week_ending,scheme_code" });
    if (error) throw new Error(`Saving snapshots failed: ${error.message}`);
  }
}

/**
 * Fill weekly snapshots for the past `weeks` Fridays from stored NAV history,
 * so the trend chart has data from day one instead of growing one point per week.
 */
export async function backfillSnapshots(funds: Fund[], weeks = 52): Promise<number> {
  if (funds.length === 0) return 0;
  const latest = lastFridayOnOrBefore(todayIST());
  const fridays = Array.from({ length: weeks }, (_, i) => addDays(latest, -7 * i));
  const series = await loadSeries(trackedCodes(funds), historyStart(fridays.at(-1)!));
  const snapshots = fridays
    .flatMap((d) => computeSnapshots(funds, d, series))
    .filter((s) => s.wow !== null || s.mom !== null || s.ytd !== null);
  await saveSnapshots(snapshots);
  return snapshots.length;
}
