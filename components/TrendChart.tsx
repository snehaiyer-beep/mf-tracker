"use client";

import { prettyName } from "./format";
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
        fund: s[metric],
        index: s[`bench_${metric}` as const],
        cat: s[`cat_${metric}` as const],
      }));
  }, [snapshots, selected, metric]);

  const hasIndex = Boolean(selected?.benchmark_name);

  return (
    <section className="panel">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">Weekly trend</h2>
        <div className="flex flex-wrap gap-2">
          <select
            className="input w-auto max-w-[220px] py-1.5"
            value={selected?.scheme_code ?? ""}
            onChange={(e) => setCode(Number(e.target.value))}
          >
            {funds.map((f) => (
              <option key={f.scheme_code} value={f.scheme_code}>
                {prettyName(f.name)}
              </option>
            ))}
          </select>
          <div className="flex rounded-lg border border-line bg-surface2 p-0.5">
            {(Object.keys(METRIC_LABEL) as Metric[]).map((m) => (
              <button
                key={m}
                onClick={() => setMetric(m)}
                className={`rounded-md px-2.5 py-1 text-xs transition ${metric === m ? "bg-accent text-white" : "text-muted hover:text-ink"}`}
              >
                {METRIC_LABEL[m]}
              </button>
            ))}
          </div>
        </div>
      </div>
      {data.length === 0 ? (
        <div className="flex h-60 items-center justify-center rounded-xl border border-dashed border-line text-sm text-muted">
          Each Saturday&apos;s report adds a point here.
        </div>
      ) : (
        <div className="h-64 w-full">
          <ResponsiveContainer>
            <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: -8 }}>
              <CartesianGrid stroke="#1e2a4a" vertical={false} />
              <XAxis
                dataKey="week"
                tick={{ fontSize: 11, fill: "#8b95b3" }}
                tickFormatter={(d: string) => d.slice(5)}
                axisLine={{ stroke: "#1e2a4a" }}
                tickLine={false}
              />
              <YAxis tick={{ fontSize: 11, fill: "#8b95b3" }} tickFormatter={(v: number) => `${v.toFixed(1)}%`} axisLine={false} tickLine={false} width={56} />
              <Tooltip
                contentStyle={{ background: "#141d36", border: "1px solid #1e2a4a", borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: "#e6eaf5" }}
                itemStyle={{ color: "#e6eaf5" }}
                cursor={{ stroke: "#5b6585", strokeDasharray: "3 3" }}
                formatter={(v) => (typeof v === "number" ? `${v >= 0 ? "+" : ""}${v.toFixed(2)}%` : "—")}
              />
              <Legend wrapperStyle={{ fontSize: 12, color: "#8b95b3" }} iconType="plainline" />
              <Line type="monotone" dataKey="fund" name="This fund" stroke="#3987e5" strokeWidth={2} dot={{ r: 4, strokeWidth: 0, fill: "#3987e5" }} activeDot={{ r: 5 }} connectNulls />
              {hasIndex && (
                <Line type="monotone" dataKey="index" name={`${selected?.benchmark_name} (proxy)`} stroke="#d95926" strokeWidth={2} dot={{ r: 4, strokeWidth: 0, fill: "#d95926" }} activeDot={{ r: 5 }} connectNulls />
              )}
              <Line type="monotone" dataKey="cat" name="Similar funds avg" stroke="#199e70" strokeWidth={2} dot={{ r: 4, strokeWidth: 0, fill: "#199e70" }} activeDot={{ r: 5 }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
