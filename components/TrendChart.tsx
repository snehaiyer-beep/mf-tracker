"use client";

import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Fund } from "@/lib/supabase";
import type { PeriodBar, TrendPoint, TrendRange } from "@/lib/trend";
import { api, prettyName } from "./format";

type LineResponse = { kind: "line"; start: string; end: string; points: TrendPoint[]; benchmark_name: string | null };
type BarsResponse = { kind: "bars"; source: "snapshots" | "prices"; bars: PeriodBar[]; benchmark_name: string | null };
type TrendResponse = LineResponse | BarsResponse;

const RANGE_LABEL: Record<TrendRange, string> = { week: "Week", month: "Month", year: "Year" };
const HEADING: Record<TrendRange, string> = {
  week: "Up or down each week: last 12 weeks",
  month: "Up or down each month: last 12 months",
  year: "How your money grew: past year",
};

const COLORS = { fund: "#3987e5", index: "#d95926", cat: "#199e70" };
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const longDate = (d: string) => {
  const dt = new Date(`${d}T00:00:00Z`);
  return `${DAYS[dt.getUTCDay()]} ${dt.getUTCDate()} ${MONTHS[dt.getUTCMonth()]} ${dt.getUTCFullYear()}`;
};
const shortDate = (d: string) => {
  const dt = new Date(`${d}T00:00:00Z`);
  return `${dt.getUTCDate()} ${MONTHS[dt.getUTCMonth()]}`;
};
const monthYear = (d: string) => {
  const dt = new Date(`${d}T00:00:00Z`);
  return `${MONTHS[dt.getUTCMonth()]} '${String(dt.getUTCFullYear()).slice(2)}`;
};
const signed = (v: number | null | undefined) => (typeof v === "number" ? `${v >= 0 ? "+" : ""}${v.toFixed(2)}%` : "—");

const axisProps = { tick: { fontSize: 11, fill: "#8b95b3" }, tickLine: false } as const;
const tooltipStyle = {
  contentStyle: { background: "#141d36", border: "1px solid #1e2a4a", borderRadius: 8, fontSize: 12 },
  labelStyle: { color: "#e6eaf5" },
  itemStyle: { color: "#e6eaf5" },
};

/** Plain-language read-out under the bars: how many periods were up, best and worst. */
function BarsSummary({ bars, range }: { bars: PeriodBar[]; range: "week" | "month" }) {
  const valid = bars.filter((b) => b.fund !== null);
  if (valid.length === 0) return null;
  const unit = range === "week" ? "weeks" : "months";
  const up = valid.filter((b) => (b.fund ?? 0) >= 0).length;
  const best = valid.reduce((a, b) => ((b.fund ?? -Infinity) > (a.fund ?? -Infinity) ? b : a));
  const worst = valid.reduce((a, b) => ((b.fund ?? Infinity) < (a.fund ?? Infinity) ? b : a));
  const beatSimilar = valid.filter((b) => b.cat !== null && (b.fund ?? 0) >= b.cat).length;
  const name = (b: PeriodBar) => (range === "week" ? `week ending ${b.label}` : b.label);
  return (
    <p className="mt-3 text-sm text-muted">
      This fund went <span className="text-up">up in {up}</span> of the last {valid.length} {unit}, and did as well as or better than similar
      funds in {beatSimilar} of them. Best: {name(best)} ({signed(best.fund)}). Worst: {name(worst)} ({signed(worst.fund)}).
    </p>
  );
}

export function TrendChart({ funds }: { funds: Fund[] }) {
  const [code, setCode] = useState<number | null>(null);
  const [range, setRange] = useState<TrendRange>("week");
  const [trend, setTrend] = useState<TrendResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selected = funds.find((f) => f.scheme_code === code) ?? funds[0];
  const selectedCode = selected?.scheme_code;
  const hasIndex = Boolean(selected?.benchmark_name);
  const indexName = `Benchmark: ${selected?.stated_benchmark ?? selected?.benchmark_name ?? "—"}`;

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

  // Ignore a response for a different range while the new one loads.
  const bars = trend?.kind === "bars" && range !== "year" ? trend.bars : null;
  const line = trend?.kind === "line" && range === "year" ? trend : null;
  const empty = !bars?.length && !line?.points.length;

  let subtitle = "";
  if (bars?.length) {
    subtitle = `Each group of bars is one ${range === "week" ? "week (Friday to Friday)" : "calendar month"}. Above the line = went up, below = went down.`;
    if (bars.at(-1)?.partial) subtitle += ` The last ${range} is still in progress.`;
    if (trend?.kind === "bars" && trend.source === "snapshots") subtitle += " Read from your saved weekly snapshots.";
  } else if (line?.start) {
    subtitle = `From ${longDate(line.start)} to ${longDate(line.end)}. All lines start at 0%, so the higher line grew more.`;
  }

  return (
    <section className="panel">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">{HEADING[range]}</h2>
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
      <p className="mb-4 min-h-[16px] text-xs text-muted">{subtitle}</p>

      {error ? (
        <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-down/40 text-sm text-down">{error}</div>
      ) : empty ? (
        <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-line text-sm text-muted">
          {loading ? "Loading…" : "No price history yet for this fund."}
        </div>
      ) : (
        <>
          <div className={`h-64 w-full transition-opacity ${loading ? "opacity-50" : ""}`}>
            <ResponsiveContainer>
              {bars ? (
                <BarChart data={bars} margin={{ top: 8, right: 8, bottom: 0, left: -8 }} barGap={2} barCategoryGap="22%">
                  <CartesianGrid stroke="#1e2a4a" vertical={false} />
                  <ReferenceLine y={0} stroke="#5b6585" />
                  <XAxis dataKey="label" {...axisProps} axisLine={{ stroke: "#1e2a4a" }} interval={0} angle={bars.length > 8 ? -35 : 0} textAnchor={bars.length > 8 ? "end" : "middle"} height={bars.length > 8 ? 44 : 24} />
                  <YAxis {...axisProps} axisLine={false} width={52} tickFormatter={(v: number) => `${v.toFixed(1)}%`} />
                  <Tooltip
                    {...tooltipStyle}
                    cursor={{ fill: "rgba(139,149,179,0.08)" }}
                    labelFormatter={(_, payload) => {
                      const b = payload?.[0]?.payload as PeriodBar | undefined;
                      if (!b) return "";
                      return `${range === "week" ? `Week ${shortDate(b.start)} → ${shortDate(b.end)}` : monthYear(b.end)}${b.partial ? " (so far)" : ""}`;
                    }}
                    formatter={(v) => signed(typeof v === "number" ? v : null)}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, color: "#8b95b3" }} iconType="square" />
                  <Bar dataKey="fund" name="This fund" fill={COLORS.fund} radius={2} isAnimationActive={false} />
                  {hasIndex && <Bar dataKey="index" name={indexName} fill={COLORS.index} radius={2} isAnimationActive={false} />}
                  <Bar dataKey="cat" name="Similar funds avg" fill={COLORS.cat} radius={2} isAnimationActive={false} />
                </BarChart>
              ) : (
                <LineChart data={line!.points} margin={{ top: 8, right: 16, bottom: 0, left: -8 }}>
                  <CartesianGrid stroke="#1e2a4a" vertical={false} />
                  <ReferenceLine y={0} stroke="#5b6585" />
                  <XAxis dataKey="date" {...axisProps} axisLine={{ stroke: "#1e2a4a" }} tickFormatter={monthYear} minTickGap={24} />
                  <YAxis {...axisProps} axisLine={false} width={56} tickFormatter={(v: number) => `${v.toFixed(1)}%`} />
                  <Tooltip
                    {...tooltipStyle}
                    cursor={{ stroke: "#5b6585", strokeDasharray: "3 3" }}
                    labelFormatter={(d) => longDate(String(d))}
                    formatter={(v) => signed(typeof v === "number" ? v : null)}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, color: "#8b95b3" }} iconType="plainline" />
                  <Line type="monotone" dataKey="fund" name="This fund" stroke={COLORS.fund} strokeWidth={2} dot={false} activeDot={{ r: 5 }} connectNulls isAnimationActive={false} />
                  {hasIndex && (
                    <Line type="monotone" dataKey="index" name={indexName} stroke={COLORS.index} strokeWidth={2} dot={false} activeDot={{ r: 5 }} connectNulls isAnimationActive={false} />
                  )}
                  <Line type="monotone" dataKey="cat" name="Similar funds avg" stroke={COLORS.cat} strokeWidth={2} dot={false} activeDot={{ r: 5 }} connectNulls isAnimationActive={false} />
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>
          {bars && range !== "year" && <BarsSummary bars={bars} range={range} />}
          {line?.points.at(-1) && (
            <p className="mt-3 text-sm text-muted">
              Over the past year, <span className="text-ink">this fund {signed(line.points.at(-1)!.fund)}</span>
              {hasIndex && <>, the market {signed(line.points.at(-1)!.index)}</>}, similar funds {signed(line.points.at(-1)!.cat)}.
            </p>
          )}
        </>
      )}
    </section>
  );
}
