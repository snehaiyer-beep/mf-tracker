import type { Fund, Snapshot } from "@/lib/supabase";
import { Pct } from "./format";

export function ReturnsTable({ funds, latest }: { funds: Fund[]; latest: Record<number, Snapshot> }) {
  const asOf = Object.values(latest)
    .map((s) => s.week_ending)
    .sort()
    .pop();

  return (
    <section className="card">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">Latest returns</h2>
        {asOf && <span className="text-xs text-slate-500">as of {asOf}</span>}
      </div>
      {funds.length === 0 ? (
        <p className="text-sm text-slate-500">Add a fund to see returns.</p>
      ) : (
        <div className="-mx-4 overflow-x-auto sm:mx-0">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2 sm:px-2">Fund</th>
                <th className="px-2 py-2"></th>
                <th className="px-2 py-2 text-right">Week</th>
                <th className="px-2 py-2 text-right">Month</th>
                <th className="px-2 py-2 text-right">Since Jan</th>
              </tr>
            </thead>
            <tbody>
              {funds.map((f) => {
                const s = latest[f.scheme_code];
                const rows: [string, number | null | undefined, number | null | undefined, number | null | undefined][] = [
                  ["Fund", s?.wow, s?.mom, s?.ytd],
                  [`${f.benchmark_name ?? "Index"} (proxy)`, s?.bench_wow, s?.bench_mom, s?.bench_ytd],
                  ["Category avg", s?.cat_wow, s?.cat_mom, s?.cat_ytd],
                ];
                return rows.map(([label, w, m, y], i) => (
                  <tr key={`${f.scheme_code}-${i}`} className={i === 2 ? "border-b border-slate-200" : ""}>
                    {i === 0 && (
                      <td rowSpan={3} className="max-w-[220px] px-4 py-2 align-top font-medium sm:px-2">
                        {f.name}
                        {!s && <div className="text-xs font-normal text-slate-400">No snapshot yet</div>}
                      </td>
                    )}
                    <td className={`px-2 py-1 text-xs ${i === 0 ? "font-semibold text-slate-700" : "text-slate-500"}`}>
                      {label}
                    </td>
                    <td className="px-2 py-1 text-right tabular-nums"><Pct value={w} /></td>
                    <td className="px-2 py-1 text-right tabular-nums"><Pct value={m} /></td>
                    <td className="px-2 py-1 text-right tabular-nums"><Pct value={y} /></td>
                  </tr>
                ));
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
