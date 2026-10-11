import type { Snapshot } from "./supabase";

export type FundStatus = { key: "ahead" | "ok" | "watch" | "lagging"; label: string; hint: string };

/**
 * Plain-language health check for non-finance readers: compare the fund's return since January
 * with the average of similar funds. Gaps are in percentage points.
 */
export function fundStatus(s: Snapshot | undefined): FundStatus | null {
  if (!s || s.ytd === null || s.cat_ytd === null) return null;
  const gap = s.ytd - s.cat_ytd;
  if (gap >= 2) return { key: "ahead", label: "Doing well", hint: `${gap.toFixed(1)} points ahead of similar funds since January` };
  if (gap > -2) return { key: "ok", label: "On track", hint: "Moving in line with similar funds since January" };
  if (gap > -5) return { key: "watch", label: "Keep an eye", hint: `${Math.abs(gap).toFixed(1)} points behind similar funds since January` };
  return { key: "lagging", label: "Lagging", hint: `${Math.abs(gap).toFixed(1)} points behind similar funds since January` };
}

export const STATUS_STYLE: Record<FundStatus["key"], string> = {
  ahead: "border-up/40 bg-up/10 text-up",
  ok: "border-accent/40 bg-accent/10 text-sky-300",
  watch: "border-amber-400/40 bg-amber-400/10 text-amber-200",
  lagging: "border-down/40 bg-down/10 text-down",
};

export const STATUS_ICON: Record<FundStatus["key"], string> = { ahead: "▲", ok: "●", watch: "!", lagging: "▼" };
