import { pickPeers } from "./amfi";
import { pickBenchmark } from "./benchmarks";
import { fetchScheme } from "./mfapi";
import { syncMany, type SyncSummary } from "./nav";
import { db, type Fund } from "./supabase";

export const BACKFILL_DAYS = 400; // a year plus buffer so YTD always has last December

export async function listFunds(): Promise<Fund[]> {
  const { data, error } = await db()
    .from("funds")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Loading funds failed: ${error.message}`);
  return (data ?? []) as Fund[];
}

/** Validate a scheme code, auto-fill details, pick benchmark + peers, save, and backfill NAVs. */
export async function addFund(code: number): Promise<{ fund: Fund; backfill: SyncSummary }> {
  const scheme = await fetchScheme(code); // throws if invalid
  const benchmark = pickBenchmark(scheme.category, scheme.name);
  const peers = await pickPeers(scheme.category, code);

  const fund: Fund = {
    scheme_code: code,
    name: scheme.name,
    category: scheme.category || null,
    benchmark_code: benchmark?.code ?? null,
    benchmark_name: benchmark?.name ?? null,
    peer_codes: peers,
    is_active: true,
  };
  const { error } = await db().from("funds").upsert(fund, { onConflict: "scheme_code" });
  if (error) throw new Error(`Saving fund failed: ${error.message}`);

  const codes = [code, ...peers, ...(benchmark ? [benchmark.code] : [])];
  const backfill = await syncMany(codes, BACKFILL_DAYS);
  return { fund, backfill };
}

export async function removeFund(code: number): Promise<void> {
  const { error } = await db().from("funds").update({ is_active: false }).eq("scheme_code", code);
  if (error) throw new Error(`Removing fund failed: ${error.message}`);
}
