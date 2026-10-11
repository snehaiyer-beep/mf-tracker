"use client";

import { useState } from "react";
import type { Fund } from "@/lib/supabase";
import { api } from "./format";

export type ReportRow = {
  id: number;
  week_ending: string;
  verdict: string | null;
  email_sent: boolean;
  created_at: string;
  report: { funds: { scheme_code: number; summary: string }[]; verdict: string; reason: string } | null;
};

const VERDICT_STYLE: Record<string, string> = {
  "No action needed": "bg-green-100 text-green-800",
  "One fund worth watching": "bg-yellow-100 text-yellow-800",
  "Consider reviewing your allocation": "bg-red-100 text-red-800",
};

export function Reports({ reports, funds, onChange }: { reports: ReportRow[]; funds: Fund[]; onChange: () => void }) {
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [openId, setOpenId] = useState<number | null>(reports[0]?.id ?? null);
  const nameByCode = new Map(funds.map((f) => [f.scheme_code, f.name]));

  async function run() {
    setRunning(true);
    setMessage(null);
    try {
      const res = await api<{ verdict: string; email_sent: boolean; email_error: string | null }>("/api/report/run", {
        method: "POST",
      });
      setMessage({
        kind: res.email_error ? "error" : "ok",
        text: `Report ready: ${res.verdict}. ${res.email_sent ? "Email sent." : `Email not sent: ${res.email_error}`}`,
      });
      setOpenId(null);
      onChange();
    } catch (err) {
      setMessage({ kind: "error", text: (err as Error).message });
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="card">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Reports</h2>
        <button className="btn" onClick={run} disabled={running || funds.length === 0}>
          {running ? "Generating… (up to a minute)" : "Generate report now"}
        </button>
      </div>
      {message && (
        <p className={`mb-3 text-sm ${message.kind === "ok" ? "text-green-700" : "text-red-700"}`}>{message.text}</p>
      )}
      {reports.length === 0 ? (
        <p className="text-sm text-slate-500">No reports yet. One is generated every Saturday at 8 AM IST.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {reports.map((r) => {
            const open = openId === r.id || (openId === null && r === reports[0]);
            return (
              <li key={r.id} className="py-2">
                <button className="flex w-full flex-wrap items-center justify-between gap-2 text-left" onClick={() => setOpenId(open ? -1 : r.id)}>
                  <span className="text-sm font-medium">Week of {r.week_ending}</span>
                  <span className="flex items-center gap-2">
                    {r.verdict && (
                      <span className={`rounded-full px-2 py-0.5 text-xs ${VERDICT_STYLE[r.verdict] ?? "bg-slate-100"}`}>{r.verdict}</span>
                    )}
                    <span className="text-xs text-slate-400">{r.email_sent ? "emailed" : "not emailed"}</span>
                  </span>
                </button>
                {open && r.report && (
                  <div className="mt-3 space-y-3 rounded-lg bg-slate-50 p-3 text-sm">
                    <p className="font-medium">{r.report.reason}</p>
                    {r.report.funds.map((f) => (
                      <div key={f.scheme_code}>
                        <div className="text-xs font-semibold text-slate-600">{nameByCode.get(f.scheme_code) ?? `Scheme ${f.scheme_code}`}</div>
                        <p className="text-slate-700">{f.summary}</p>
                      </div>
                    ))}
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
