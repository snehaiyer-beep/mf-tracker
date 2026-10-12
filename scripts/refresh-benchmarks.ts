/**
 * Re-pick the stated benchmark and its stand-in for every active fund (after changing
 * lib/benchmarks.ts), backfill the stand-ins' NAVs, and recompute weekly snapshots.
 *
 *   npx tsx scripts/refresh-benchmarks.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

import { MARKET_INDICES, pickBenchmark } from "../lib/benchmarks";
import { BACKFILL_DAYS, listFunds } from "../lib/funds";
import { syncMany } from "../lib/nav";
import { backfillSnapshots } from "../lib/snapshots";
import { db } from "../lib/supabase";

async function main() {
  const funds = await listFunds();
  for (const f of funds) {
    const { stated, proxy } = pickBenchmark(f.category ?? "", f.name);
    const { error } = await db()
      .from("funds")
      .update({ stated_benchmark: stated, benchmark_code: proxy?.code ?? null, benchmark_name: proxy?.name ?? null })
      .eq("scheme_code", f.scheme_code);
    if (error) throw new Error(error.message);
    console.log(`${f.name.slice(0, 45).padEnd(45)} -> ${stated} (stand-in: ${proxy?.name ?? "none"})`);
  }
  const updated = await listFunds();
  const proxies = [...updated.map((f) => f.benchmark_code).filter((c): c is number => c !== null), ...MARKET_INDICES.map((b) => b.code)];
  const sync = await syncMany(proxies, BACKFILL_DAYS, 4);
  console.log(`Stand-in NAVs: ${sync.ok} ok, ${sync.rows} rows, ${sync.failed.length} failed`);
  console.log(`Weekly snapshots recomputed: ${await backfillSnapshots(updated)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
