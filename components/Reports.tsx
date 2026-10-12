"use client";

import { prettyName } from "./format";
import { useState } from "react";
import type { Fund } from "@/lib/supabase";

export type ReportRow = {
  id: number;
  week_ending: string;
  verdict: string | null;
  email_sent: boolean;
  created_at: string;
  report: {
    funds: { scheme_code: number; summary: string }[];
    verdict: string;
    watch_scheme_codes?: number[];
    reason: string;
  } | null;
};

const DOT: Record<string, string> = {
  "No action needed": "bg-up",
  "One fund worth watching": "bg-amber-400",
  "Consider reviewing your allocation": "bg-down",
};

const generatedAt = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

export function Reports({ reports, funds }: { reports: ReportRow[]; funds: Fund[] }) {
  const [openId, setOpenId] = useState<number | null>(null);
  const nameByCode = new Map(funds.map((f) => [f.scheme_code, prettyName(f.name)]));

  return (
    <section className="panel">
      <h2 className="mb-1 text-base font-semibold">Past reports{reports.length > 0 ? ` (${reports.length})` : ""}</h2>
      <p className="mb-3 text-[11px] text-faint">Every report is kept, newest first, including re-generated ones.</p>
      {reports.length === 0 ? (
        <p className="text-sm text-muted">Nothing yet.</p>
      ) : (
        <ul className="-mx-2 max-h-[300px] space-y-1 overflow-y-auto">
          {reports.map((r) => {
            const open = openId === r.id;
            return (
              <li key={r.id} className={`rounded-lg ${open ? "bg-surface2" : ""}`}>
                <button
                  className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-2 text-left transition hover:bg-surface2"
                  onClick={() => setOpenId(open ? null : r.id)}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${DOT[r.verdict ?? ""] ?? "bg-faint"}`} />
                    <span className="min-w-0">
                      <span className="block truncate text-sm">
                        Week ending {r.week_ending}
                        {r === reports[0] && <span className="ml-1.5 rounded bg-accent/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-sky-300">Latest</span>}
                      </span>
                      <span className="block text-[11px] text-faint">Generated {generatedAt(r.created_at)}</span>
                    </span>
                  </span>
                  <span className="shrink-0 text-[11px] text-muted">
                    {r.verdict ?? "—"} {r.email_sent ? "· ✉" : ""}
                  </span>
                </button>
                {open && r.report && (
                  <div className="space-y-2 px-2 pb-3 text-xs leading-relaxed text-muted">
                    {r.report.funds.map((f) => (
                      <p key={f.scheme_code}>
                        <span className="font-semibold text-ink/90">{nameByCode.get(f.scheme_code) ?? f.scheme_code}: </span>
                        {f.summary}
                      </p>
                    ))}
                    <div className="rounded-md border border-line bg-surface p-2">
                      <div className="label mb-0.5">Overall portfolio assessment</div>
                      <p className="font-semibold text-ink">{r.report.verdict}</p>
                      <p className="text-ink/90">
                        <span className="font-semibold">Why: </span>
                        {r.report.reason}
                      </p>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
