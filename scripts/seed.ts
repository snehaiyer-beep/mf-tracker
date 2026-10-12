/**
 * Backfill ~2 years of NAVs and 52 weeks of trend snapshots.
 *
 *   npm run seed                    -> backfill every active fund (+ its benchmark and peers)
 *   npm run seed -- 122639 118989   -> add these scheme codes as funds, then backfill
 *
 * Reads credentials from .env.local (or .env).
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

import { MARKET_INDICES } from "../lib/benchmarks";
import { addFund, BACKFILL_DAYS, listFunds } from "../lib/funds";
import { syncMany } from "../lib/nav";
import { backfillSnapshots } from "../lib/snapshots";

async function main() {
  const codes = process.argv.slice(2).map(Number).filter((n) => Number.isInteger(n) && n > 0);

  for (const code of codes) {
    try {
      const { fund, backfill } = await addFund(code);
      console.log(`Added ${fund.name} (${code}); benchmark: ${fund.benchmark_name ?? "none"}; peers: ${fund.peer_codes.length}; rows: ${backfill.rows}`);
      backfill.failed.forEach((f) => console.warn(`  failed ${f.code}: ${f.error}`));
    } catch (err) {
      console.error(`Could not add ${code}:`, err instanceof Error ? err.message : err);
    }
  }

  const funds = await listFunds();
  const all = [
    ...funds.flatMap((f) => [f.scheme_code, ...(f.peer_codes ?? []), ...(f.benchmark_code ? [f.benchmark_code] : [])]),
    ...MARKET_INDICES.map((b) => b.code),
  ];
  console.log(`Backfilling ${new Set(all).size} schemes for ${funds.length} funds…`);
  const summary = await syncMany(all, BACKFILL_DAYS, 4);
  console.log(`Done: ${summary.ok} ok, ${summary.rows} rows, ${summary.failed.length} failed`);
  summary.failed.forEach((f) => console.warn(`  failed ${f.code}: ${f.error}`));

  const snaps = await backfillSnapshots(funds);
  console.log(`Weekly snapshots written: ${snaps}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
