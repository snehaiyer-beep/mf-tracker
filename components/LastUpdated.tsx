"use client";

import { useEffect, useState } from "react";

export type JobRun = { job: "daily" | "weekly"; trigger: "scheduled" | "manual" | "dashboard"; ran_at: string; ok: boolean; detail: Record<string, unknown> | null };

export type Updates = {
  prices_as_of: string | null;
  latest_news_at: string | null;
  daily_ran_at: string | null;
  report_at: string | null;
  next_daily: string;
  next_report: string;
  history: JobRun[];
};

const JOB_LABEL = { daily: "Prices & news refresh", weekly: "Weekly report & email" } as const;
const TRIGGER_LABEL = { scheduled: "automatic", manual: "run by hand", dashboard: "report button" } as const;

/** Short plain-language result for one run. */
function runDetail(r: JobRun): string {
  const d = r.detail ?? {};
  if (!r.ok && typeof d.error === "string") return d.error;
  if (r.job === "daily") return `${d.navs_ok ?? "?"} price feeds updated, ${d.news_stored ?? 0} headlines`;
  if (typeof d.email_error === "string" && d.email_error) return `Report saved; email failed: ${d.email_error}`;
  return `${d.verdict ?? "Report saved"}${d.email_sent ? ", email sent" : ""}`;
}

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
  const [showHistory, setShowHistory] = useState(false);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  return (
    <section className="panel py-3">
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
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
      </div>
      <button
        onClick={() => setShowHistory((v) => !v)}
        className="mt-2 text-[11px] text-accent hover:underline"
        aria-expanded={showHistory}
      >
        {showHistory ? "Hide automation history ▴" : "Show automation history ▾"}
      </button>
      {showHistory && (
        <ul className="mt-2 divide-y divide-line rounded-lg border border-line">
          {updates.history.length === 0 && <li className="px-3 py-2 text-xs text-muted">No runs recorded yet.</li>}
          {updates.history.map((r) => (
            <li key={r.ran_at + r.job} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-3 py-2 text-xs">
              <span className={r.ok ? "text-up" : "text-down"} aria-label={r.ok ? "succeeded" : "failed"}>
                {r.ok ? "✓" : "✗"}
              </span>
              <span className="font-medium text-ink">{JOB_LABEL[r.job]}</span>
              <span className="rounded border border-line px-1.5 text-[10px] uppercase tracking-wide text-faint">{TRIGGER_LABEL[r.trigger]}</span>
              <span className="text-muted">{fmtTime(r.ran_at)}</span>
              <span className="basis-full pl-5 text-faint sm:basis-auto sm:pl-0">{runDetail(r)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
