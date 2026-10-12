"use client";

import { useEffect, useState } from "react";

export type Updates = {
  prices_as_of: string | null;
  latest_news_at: string | null;
  daily_ran_at: string | null;
  report_at: string | null;
  next_daily: string;
  next_report: string;
};

const fmtDay = (d: string) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });

function ago(iso: string, now: number): string {
  const mins = Math.round((now - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} h ago`;
  const days = Math.round(hrs / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function Item({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="min-w-0">
      <div className="label">{label}</div>
      <div className="truncate text-sm font-medium">{value}</div>
      {sub && <div className="truncate text-[11px] text-faint">{sub}</div>}
    </div>
  );
}

/** "When was this last updated?" in one strip: data freshness plus when the next updates are due. */
export function LastUpdated({ updates }: { updates: Updates }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  return (
    <section className="panel grid grid-cols-2 gap-x-4 gap-y-3 py-3 sm:grid-cols-4">
      <Item
        label="Fund prices"
        value={updates.prices_as_of ? `As of ${fmtDay(updates.prices_as_of)}` : "—"}
        sub="Published after markets close on trading days"
      />
      <Item
        label="Last checked"
        value={updates.daily_ran_at ? ago(updates.daily_ran_at, now) : "—"}
        sub={`Next check: ${fmtTime(updates.next_daily)}`}
      />
      <Item
        label="Latest news"
        value={updates.latest_news_at ? ago(updates.latest_news_at, now) : "—"}
        sub={updates.latest_news_at ? fmtTime(updates.latest_news_at) : undefined}
      />
      <Item
        label="Weekly report"
        value={updates.report_at ? fmtTime(updates.report_at) : "Not yet"}
        sub={`Next: ${fmtTime(updates.next_report)}`}
      />
    </section>
  );
}
