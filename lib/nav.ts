import { addDays, todayIST } from "./dates";
import { errorMessage, mapLimit } from "./http";
import { fetchScheme, type NavPoint } from "./mfapi";
import { db } from "./supabase";

const CHUNK = 1000;

/** Fetch a scheme from mfapi and upsert NAVs from the last `days` days. Returns rows written. */
export async function syncNavs(code: number, days: number): Promise<number> {
  const scheme = await fetchScheme(code);
  const since = addDays(todayIST(), -days);
  const rows = scheme.navs
    .filter((p) => p.date >= since)
    .map((p) => ({ scheme_code: code, date: p.date, nav: p.nav }));
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await db()
      .from("nav_history")
      .upsert(rows.slice(i, i + CHUNK), { onConflict: "scheme_code,date" });
    if (error) throw new Error(`Supabase upsert for ${code} failed: ${error.message}`);
  }
  return rows.length;
}

export type SyncSummary = { ok: number; failed: { code: number; error: string }[]; rows: number };

export async function syncMany(codes: number[], days: number, concurrency = 4): Promise<SyncSummary> {
  const unique = Array.from(new Set(codes));
  const results = await mapLimit(unique, concurrency, (code) => syncNavs(code, days));
  const summary: SyncSummary = { ok: 0, failed: [], rows: 0 };
  results.forEach((r, i) => {
    if (r.status === "fulfilled") {
      summary.ok++;
      summary.rows += r.value;
    } else {
      summary.failed.push({ code: unique[i], error: errorMessage(r.reason) });
    }
  });
  return summary;
}

/** Load NAV series (ascending) for many codes from `since` onwards. */
export async function loadSeries(codes: number[], since: string): Promise<Map<number, NavPoint[]>> {
  const map = new Map<number, NavPoint[]>();
  const unique = Array.from(new Set(codes));
  const results = await mapLimit(unique, 8, async (code) => {
    const { data, error } = await db()
      .from("nav_history")
      .select("date, nav")
      .eq("scheme_code", code)
      .gte("date", since)
      .order("date", { ascending: true })
      .limit(1000);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => ({ date: String(r.date), nav: Number(r.nav) }));
  });
  results.forEach((r, i) => {
    if (r.status === "fulfilled") map.set(unique[i], r.value);
    else console.error(`Loading NAVs for ${unique[i]} failed`, r.reason);
  });
  return map;
}
