"use client";

import { useMemo, useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Fund, Snapshot } from "@/lib/supabase";

type Metric = "ytd" | "mom" | "wow";
const METRIC_LABEL: Record<Metric, string> = { ytd: "Since Jan", mom: "Month", wow: "Week" };

export function TrendChart({ funds, snapshots }: { funds: Fund[]; snapshots: Snapshot[] }) {
  const [code, setCode] = useState<number | null>(null);
  const [metric, setMetric] = useState<Metric>("ytd");
  const selected = funds.find((f) => f.scheme_code === code) ?? funds[0];

  const data = useMemo(() => {
    if (!selected) return [];
    return snapshots
      .filter((s) => s.scheme_code === selected.scheme_code)
      .map((s) => ({
        week: s.week_ending,
        Fund: s[metric],
        Index: s[`bench_${metric}` as const],
        Category: s[`cat_${metric}` as const],
      }));
  }, [snapshots, selected, metric]);

  return (
    <section className="card">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Trend</h2>
        <div className="flex flex-wrap gap-2">
          <select
            className="max-w-[240px] rounded-lg border border-slate-300 px-2 py-1 text-sm"
            value={selected?.scheme_code ?? ""}
            onChange={(e) => setCode(Number(e.target.value))}
          >
            {funds.map((f) => (
              <option key={f.scheme_code} value={f.scheme_code}>
                {f.name}
              </option>
            ))}
          </select>
          <select
            className="rounded-lg border border-slate-300 px-2 py-1 text-sm"
            value={metric}
            onChange={(e) => setMetric(e.target.value as Metric)}
          >
            {(Object.keys(METRIC_LABEL) as Metric[]).map((m) => (
              <option key={m} value={m}>
                {METRIC_LABEL[m]}
              </option>
            ))}
          </select>
        </div>
      </div>
      {data.length === 0 ? (
        <p className="text-sm text-slate-500">Weekly snapshots will appear here after the first report runs.</p>
      ) : (
        <div className="h-72 w-full">
          <ResponsiveContainer>
            <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
              <XAxis dataKey="week" tick={{ fontSize: 11 }} tickFormatter={(d: string) => d.slice(5)} />
              <YAxis tick={{ fontSize: 11 }} unit="%" />
              <Tooltip formatter={(v) => (typeof v === "number" ? `${v.toFixed(2)}%` : "—")} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="Fund" stroke="#0f172a" strokeWidth={2} dot={false} connectNulls />
              <Line type="monotone" dataKey="Index" name={`${selected?.benchmark_name ?? "Index"} (proxy)`} stroke="#2563eb" dot={false} connectNulls />
              <Line type="monotone" dataKey="Category" name="Category avg" stroke="#f59e0b" dot={false} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
