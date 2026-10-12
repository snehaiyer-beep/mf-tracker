"use client";

import { useEffect, useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Fund } from "@/lib/supabase";
import type { TrendPoint, TrendRange } from "@/lib/trend";
import { api, prettyName } from "./format";

const RANGE_LABEL: Record<TrendRange, string> = { week: "Week", month: "Month", year: "Year" };
const RANGE_PHRASE: Record<TrendRange, string> = { week: "past week", month: "past month", year: "past year" };

type TrendResponse = { start: string; end: string; points: TrendPoint[]; benchmark_name: string | null };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function fmtDate(d: string, range: TrendRange, long = false): string {
  const dt = new Date(`${d}T00:00:00Z`);
  const day = dt.getUTCDate();
  const mon = MONTHS[dt.getUTCMonth()];
  if (long) return `${DAYS[dt.getUTCDay()]} ${day} ${mon} ${dt.getUTCFullYear()}`;
  if (range === "week") return `${DAYS[dt.getUTCDay()]} ${day}`;
  if (range === "month") return `${day} ${mon}`;
  return `${mon} '${String(dt.getUTCFullYear()).slice(2)}`;
}

const signed = (v: number | null | undefined) => (typeof v === "number" ? `${v >= 0 ? "+" : ""}${v.toFixed(2)}%` : "—");

export function TrendChart({ funds }: { funds: Fund[] }) {
  const [code, setCode] = useState<number | null>(null);
  const [range, setRange] = useState<TrendRange>("year");
  const [trend, setTrend] = useState<TrendResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selected = funds.find((f) => f.scheme_code === code) ?? funds[0];
  const selectedCode = selected?.scheme_code;

  useEffect(() => {
    if (!selectedCode) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    api<TrendResponse>(`/api/trend?scheme_code=${selectedCode}&range=${range}`)
      .then((t) => {
        if (!cancelled) setTrend(t);
      })
      .catch((err) => {
        if (!cancelled) setError((err as Error).message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedCode, range]);

  const points = trend?.points ?? [];
  const last = points.at(-1);
  const hasIndex = Boolean(selected?.benchmark_name);
  const dot = (fill: string) => (range === "year" ? false : { r: 3, strokeWidth: 0, fill });

  return (
    <section className="panel">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">How your money grew: {RANGE_PHRASE[range]}</h2>
        <div className="flex flex-wrap gap-2">
          <select
            className="input w-auto max-w-[220px] py-1.5"
            value={selectedCode ?? ""}
            onChange={(e) => setCode(Number(e.target.value))}
          >
            {funds.map((f) => (
              <option key={f.scheme_code} value={f.scheme_code}>
                {prettyName(f.name)}
              </option>
            ))}
          </select>
          <div className="flex rounded-lg border border-line bg-surface2 p-0.5" role="tablist">
            {(Object.keys(RANGE_LABEL) as TrendRange[]).map((r) => (
              <button
                key={r}
                role="tab"
                aria-selected={range === r}
                onClick={() => setRange(r)}
                className={`rounded-md px-2.5 py-1 text-xs transition ${range === r ? "bg-accent text-white" : "text-muted hover:text-ink"}`}
              >
                {RANGE_LABEL[r]}
              </button>
            ))}
          </div>
        </div>
      </div>
      <p className="mb-4 text-xs text-muted">
        {trend?.start ? `From ${fmtDate(trend.start, range, true)} to ${fmtDate(trend.end, range, true)}. ` : ""}
        All lines start at 0%, so you can see which grew more.
      </p>

      {error ? (
        <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-down/40 text-sm text-down">{error}</div>
      ) : points.length === 0 ? (
        <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-line text-sm text-muted">
          {loading ? "Loading…" : "No price history yet for this fund."}
        </div>
      ) : (
        <>
          <div className={`h-64 w-full transition-opacity ${loading ? "opacity-50" : ""}`}>
            <ResponsiveContainer>
              <LineChart data={points} margin={{ top: 8, right: 16, bottom: 0, left: -8 }}>
                <CartesianGrid stroke="#1e2a4a" vertical={false} />
                <ReferenceLine y={0} stroke="#5b6585" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: "#8b95b3" }}
                  tickFormatter={(d: string) => fmtDate(d, range)}
                  minTickGap={24}
                  axisLine={{ stroke: "#1e2a4a" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#8b95b3" }}
                  tickFormatter={(v: number) => `${v.toFixed(1)}%`}
                  axisLine={false}
                  tickLine={false}
                  width={56}
                />
                <Tooltip
                  contentStyle={{ background: "#141d36", border: "1px solid #1e2a4a", borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: "#e6eaf5" }}
                  itemStyle={{ color: "#e6eaf5" }}
                  cursor={{ stroke: "#5b6585", strokeDasharray: "3 3" }}
                  labelFormatter={(d) => fmtDate(String(d), range, true)}
                  formatter={(v) => signed(typeof v === "number" ? v : null)}
                />
                <Legend wrapperStyle={{ fontSize: 12, color: "#8b95b3" }} iconType="plainline" />
                <Line type="monotone" dataKey="fund" name="This fund" stroke="#3987e5" strokeWidth={2} dot={dot("#3987e5")} activeDot={{ r: 5 }} connectNulls isAnimationActive={false} />
                {hasIndex && (
                  <Line type="monotone" dataKey="index" name={`${selected?.benchmark_name} (proxy)`} stroke="#d95926" strokeWidth={2} dot={dot("#d95926")} activeDot={{ r: 5 }} connectNulls isAnimationActive={false} />
                )}
                <Line type="monotone" dataKey="cat" name="Similar funds avg" stroke="#199e70" strokeWidth={2} dot={dot("#199e70")} activeDot={{ r: 5 }} connectNulls isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          {last && (
            <p className="mt-3 text-sm text-muted">
              Over the {RANGE_PHRASE[range]}, <span className="text-ink">this fund {signed(last.fund)}</span>
              {hasIndex && <>, the market {signed(last.index)}</>}, similar funds {signed(last.cat)}.
            </p>
          )}
        </>
      )}
    </section>
  );
}
