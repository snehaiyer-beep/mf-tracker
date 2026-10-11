"use client";

import { useState } from "react";
import type { Fund, Snapshot } from "@/lib/supabase";
import { Pct, Sparkline } from "./format";

type Period = { key: "wow" | "mom" | "ytd"; label: string };
const PERIODS: Period[] = [
  { key: "wow", label: "Week" },
  { key: "mom", label: "Month" },
  { key: "ytd", label: "Since Jan" },
];

function Cell({ s, fund, p }: { s: Snapshot | undefined; fund: Fund; p: Period }) {
  return (
    <div className="min-w-[96px]">
      <div className="text-base font-semibold">
        <Pct value={s?.[p.key]} />
      </div>
      <div className="mt-1 space-y-0.5 text-[11px] text-muted">
        {fund.benchmark_name && (
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: "var(--series-index)" }} />
            Index <Pct value={s?.[`bench_${p.key}`]} />
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: "var(--series-cat)" }} />
          Similar <Pct value={s?.[`cat_${p.key}`]} />
        </div>
      </div>
    </div>
  );
}

export function FundGrid({
  funds,
  latest,
  sparks,
  summaries,
  watched,
}: {
  funds: Fund[];
  latest: Record<number, Snapshot>;
  sparks: Record<number, number[]>;
  summaries: Map<number, string>;
  watched: Set<number>;
}) {
  const [open, setOpen] = useState<number | null>(null);
  const asOf = Object.values(latest).map((s) => s.week_ending).sort().pop();

  return (
    <section className="panel p-0 sm:p-0">
      <div className="flex flex-wrap items-baseline justify-between gap-2 px-4 pt-4 sm:px-5">
        <h2 className="text-base font-semibold">Your funds</h2>
        <span className="text-xs text-muted">{asOf ? `Returns as of ${asOf}` : "Returns appear after the first report"}</span>
      </div>

      {funds.length === 0 ? (
        <p className="px-5 py-6 text-sm text-muted">No funds yet. Add one below.</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-y border-line bg-surface2/60 text-left">
                <th className="label px-4 py-2 sm:px-5">Fund</th>
                <th className="label px-2 py-2">90 days</th>
                {PERIODS.map((p) => (
                  <th key={p.key} className="label px-2 py-2">
                    {p.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {funds.map((f) => {
                const s = latest[f.scheme_code];
                const summary = summaries.get(f.scheme_code);
                const isOpen = open === f.scheme_code;
                return (
                  <FundRow key={f.scheme_code}>
                    <tr
                      className={`cursor-pointer border-b border-line/70 align-top transition hover:bg-surface2/50 ${isOpen ? "bg-surface2/50" : ""}`}
                      onClick={() => setOpen(isOpen ? null : f.scheme_code)}
                    >
                      <td className="max-w-[260px] px-4 py-3 sm:px-5">
                        <div className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: "var(--series-fund)" }} />
                          <span className="font-medium leading-snug">{f.name.replace(/ - Direct Plan.*$/i, "")}</span>
                          {watched.has(f.scheme_code) && (
                            <span className="shrink-0 rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-200">
                              Watch
                            </span>
                          )}
                        </div>
                        <div className="mt-1 pl-[18px] text-[11px] text-faint">
                          {f.category?.replace(/^.*? - /, "") ?? "—"} · {f.scheme_code}
                          {!f.benchmark_name && " · no matching index"}
                        </div>
                        {summary && (
                          <div className="mt-1 pl-[18px] text-[11px] text-accent">{isOpen ? "Hide summary ▴" : "Read summary ▾"}</div>
                        )}
                      </td>
                      <td className="px-2 py-3">
                        <Sparkline values={sparks[f.scheme_code] ?? []} width={96} height={30} />
                      </td>
                      {PERIODS.map((p) => (
                        <td key={p.key} className="px-2 py-3">
                          <Cell s={s} fund={f} p={p} />
                        </td>
                      ))}
                    </tr>
                    {isOpen && summary && (
                      <tr className="border-b border-line/70 bg-surface2/50">
                        <td colSpan={5} className="px-4 pb-4 sm:px-5">
                          <p className="max-w-3xl border-l-2 border-accent pl-3 text-sm leading-relaxed text-ink/90">{summary}</p>
                        </td>
                      </tr>
                    )}
                  </FundRow>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function FundRow({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
