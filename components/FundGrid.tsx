"use client";

import { Fragment, useEffect, useState } from "react";
import type { Fund, Snapshot } from "@/lib/supabase";
import { fundStatus, STATUS_ICON, STATUS_STYLE } from "@/lib/status";
import { api, Pct, prettyName, Sparkline } from "./format";

type Trio = { fund: number | null | undefined; index: number | null | undefined; cat: number | null | undefined };
type ReturnsResponse = {
  year: number;
  current_year: number;
  years: number[];
  funds: Record<number, { calendar: Trio; one_year: Trio }>;
};

/** One table cell: the fund's return in large type, with its index and similar-funds average below. */
function Cell({ v, fund }: { v: Trio; fund: Fund }) {
  return (
    <div className="min-w-[92px]">
      <div className="text-base font-semibold">
        <Pct value={v.fund} />
      </div>
      <div className="mt-1 space-y-0.5 text-[11px] text-muted">
        {fund.benchmark_name && (
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: "var(--series-index)" }} />
            Index <Pct value={v.index} />
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: "var(--series-cat)" }} />
          Similar <Pct value={v.cat} />
        </div>
      </div>
    </div>
  );
}

const fromSnapshot = (s: Snapshot | undefined, key: "wow" | "mom" | "ytd"): Trio => ({
  fund: s?.[key],
  index: s?.[`bench_${key}`],
  cat: s?.[`cat_${key}`],
});

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
  // Summaries are shown by default; this tracks the ones the reader has collapsed.
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const toggle = (code: number) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });

  const [year, setYear] = useState<number | null>(null);
  const [returns, setReturns] = useState<ReturnsResponse | null>(null);
  const [loadingYear, setLoadingYear] = useState(false);
  const fundCount = funds.length;

  useEffect(() => {
    let cancelled = false;
    setLoadingYear(true);
    api<ReturnsResponse>(`/api/returns${year ? `?year=${year}` : ""}`)
      .then((r) => {
        if (!cancelled) setReturns(r);
      })
      .catch((err) => console.error(err))
      .finally(() => {
        if (!cancelled) setLoadingYear(false);
      });
    return () => {
      cancelled = true;
    };
  }, [year, fundCount]);

  const currentYear = returns?.current_year ?? new Date().getFullYear();
  const shownYear = year ?? currentYear;
  const isCurrent = shownYear === currentYear;
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
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-y border-line bg-surface2/60 text-left align-bottom">
                <th className="label px-4 py-2 sm:px-5">Fund</th>
                <th className="label px-2 py-2">90 days</th>
                <th className="label px-2 py-2">Week</th>
                <th className="label px-2 py-2">Month</th>
                <th className="px-2 py-1.5">
                  <label className="label block" htmlFor="year-pick">
                    {isCurrent ? "Since Jan" : "Full year"}
                  </label>
                  <select
                    id="year-pick"
                    value={shownYear}
                    onChange={(e) => setYear(Number(e.target.value))}
                    className="mt-0.5 rounded-md border border-line bg-surface2 px-1.5 py-0.5 text-xs text-ink outline-none focus:border-accent"
                    aria-label="Choose a year"
                  >
                    {(returns?.years ?? [currentYear]).map((y) => (
                      <option key={y} value={y}>
                        {y === currentYear ? `${y} so far` : y}
                      </option>
                    ))}
                  </select>
                </th>
                <th className="label px-2 py-2" title="The last 12 months, up to the latest price">
                  1 Year
                </th>
              </tr>
            </thead>
            <tbody>
              {funds.map((f) => {
                const s = latest[f.scheme_code];
                const r = returns?.funds[f.scheme_code];
                const summary = summaries.get(f.scheme_code);
                const isOpen = !collapsed.has(f.scheme_code);
                const status = fundStatus(s);
                // The current year uses the weekly snapshot, so it matches the report.
                const yearValues = isCurrent ? fromSnapshot(s, "ytd") : (r?.calendar ?? { fund: null, index: null, cat: null });
                return (
                  <Fragment key={f.scheme_code}>
                    <tr
                      className={`cursor-pointer border-b border-line/70 align-top transition hover:bg-surface2/50 ${isOpen ? "bg-surface2/50" : ""}`}
                      onClick={() => toggle(f.scheme_code)}
                    >
                      <td className="max-w-[260px] px-4 py-3 sm:px-5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: "var(--series-fund)" }} />
                          <span className="font-medium leading-snug">{prettyName(f.name)}</span>
                          {status && (
                            <span title={status.hint} className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${STATUS_STYLE[status.key]}`}>
                              {STATUS_ICON[status.key]} {status.label}
                            </span>
                          )}
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
                        {status && <div className="mt-1 pl-[18px] text-[11px] text-muted">{status.hint}</div>}
                        {summary && (
                          <div className="mt-1 pl-[18px] text-[11px] text-accent">{isOpen ? "Hide summary ▴" : "Show summary ▾"}</div>
                        )}
                      </td>
                      <td className="px-2 py-3">
                        <Sparkline values={sparks[f.scheme_code] ?? []} width={96} height={30} />
                      </td>
                      <td className="px-2 py-3">
                        <Cell v={fromSnapshot(s, "wow")} fund={f} />
                      </td>
                      <td className="px-2 py-3">
                        <Cell v={fromSnapshot(s, "mom")} fund={f} />
                      </td>
                      <td className={`px-2 py-3 transition-opacity ${loadingYear && !isCurrent ? "opacity-40" : ""}`}>
                        <Cell v={yearValues} fund={f} />
                      </td>
                      <td className="px-2 py-3">
                        <Cell v={r?.one_year ?? { fund: null, index: null, cat: null }} fund={f} />
                      </td>
                    </tr>
                    {isOpen && summary && (
                      <tr className="border-b border-line/70 bg-surface2/50">
                        <td colSpan={6} className="px-4 pb-4 sm:px-5">
                          <p className="max-w-3xl border-l-2 border-accent pl-3 text-sm leading-relaxed text-ink/90">{summary}</p>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
          <p className="px-4 py-2 text-[11px] text-faint sm:px-5">
            {isCurrent ? `Since Jan = from 1 January ${shownYear} until now.` : `Full year = 1 January to 31 December ${shownYear}.`} 1 Year = the last 12
            months. A dash means the fund (or its index stand-in) didn&apos;t have prices for that whole period.
          </p>
        </div>
      )}
    </section>
  );
}
