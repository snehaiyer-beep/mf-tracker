/** Signed percentage with an arrow so up/down never relies on colour alone. */
export function Pct({ value, size = "sm" }: { value: number | null | undefined; size?: "sm" | "lg" }) {
  if (value === null || value === undefined) return <span className="text-faint">—</span>;
  const n = Number(value);
  const up = n >= 0;
  return (
    <span className={`tabular-nums ${up ? "text-up" : "text-down"} ${size === "lg" ? "text-2xl font-semibold" : ""}`}>
      <span className={size === "lg" ? "mr-1 text-base" : "mr-0.5 text-[0.7em]"}>{up ? "▲" : "▼"}</span>
      {Math.abs(n).toFixed(2)}%
    </span>
  );
}

/** Tiny inline trend line. Single series, so no legend; hover shows first/last values. */
export function Sparkline({
  values,
  width = 120,
  height = 32,
  color = "var(--series-fund)",
}: {
  values: number[];
  width?: number;
  height?: number;
  color?: string;
}) {
  if (values.length < 2) return <div style={{ width, height }} />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * width, height - 2 - ((v - min) / range) * (height - 4)]);
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const change = ((values.at(-1)! / values[0] - 1) * 100).toFixed(1);
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      <title>{`Last 90 days: ${Number(change) >= 0 ? "+" : ""}${change}%`}</title>
      <path d={d} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={pts.at(-1)![0]} cy={pts.at(-1)![1]} r={2.5} fill={color} />
    </svg>
  );
}

export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    // non-JSON response
  }
  if (!res.ok) {
    const msg = (json as { error?: string } | null)?.error ?? `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return json as T;
}

const ACRONYMS = new Set(["SBI", "HDFC", "ICICI", "UTI", "DSP", "IDFC", "US", "PSU", "ELSS", "FOF", "S&P", "ETF", "LIC", "PGIM", "HSBC"]);

/** "SBI SMALL CAP FUND - Direct Plan - Growth" -> "SBI Small Cap Fund". */
export function prettyName(name: string): string {
  const base = name.replace(/\s*-\s*Direct Plan.*$/i, "").trim();
  if (base !== base.toUpperCase()) return base;
  return base
    .split(/\s+/)
    .map((w) => (ACRONYMS.has(w) ? w : w.charAt(0) + w.slice(1).toLowerCase()))
    .join(" ");
}
