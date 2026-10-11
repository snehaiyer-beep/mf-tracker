"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FundGrid } from "@/components/FundGrid";
import { FundManager } from "@/components/FundManager";
import { api } from "@/components/format";
import { IndexTiles, type IndexStat } from "@/components/IndexTiles";
import { Reports, type ReportRow } from "@/components/Reports";
import { TrendChart } from "@/components/TrendChart";
import { Verdict } from "@/components/Verdict";
import type { Fund, Snapshot } from "@/lib/supabase";

type Dashboard = {
  funds: Fund[];
  snapshots: Snapshot[];
  latest: Record<number, Snapshot>;
  reports: ReportRow[];
  indices: IndexStat[];
  sparks: Record<number, number[]>;
};

export default function Home() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [runMsg, setRunMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await api<Dashboard>("/api/dashboard"));
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function runReport() {
    setRunning(true);
    setRunMsg(null);
    try {
      const res = await api<{ verdict: string; email_sent: boolean; email_error: string | null }>("/api/report/run", { method: "POST" });
      setRunMsg({
        kind: res.email_error ? "error" : "ok",
        text: `Report ready: ${res.verdict}. ${res.email_sent ? "Email sent." : `Email not sent: ${res.email_error}`}`,
      });
    } catch (err) {
      setRunMsg({ kind: "error", text: (err as Error).message });
    } finally {
      setRunning(false);
      load();
    }
  }

  const latestReport = data?.reports[0];
  const summaries = useMemo(
    () => new Map((latestReport?.report?.funds ?? []).map((f) => [f.scheme_code, f.summary])),
    [latestReport],
  );
  const indexDate = data?.indices.find((i) => i.as_of)?.as_of;

  return (
    <>
      <header className="sticky top-0 z-10 border-b border-line bg-bg/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/15 text-sm font-bold text-accent">₹</span>
            <div>
              <div className="text-sm font-semibold leading-tight">Fund Pulse</div>
              <div className="text-[11px] text-muted">{indexDate ? `Market data to ${indexDate}` : "Weekly mutual fund check-in"}</div>
            </div>
          </div>
          <button className="btn" onClick={runReport} disabled={running || !data?.funds.length}>
            {running ? "Generating…" : "Generate report"}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-4 px-4 py-5 sm:py-6">
        {runMsg && (
          <div className={`panel py-3 text-sm ${runMsg.kind === "ok" ? "border-up/40 text-up" : "border-down/40 text-down"}`}>{runMsg.text}</div>
        )}
        {error && <div className="panel border-down/40 text-sm text-down">Couldn&apos;t load data: {error}</div>}
        {!data && !error && (
          <div className="grid gap-3 sm:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="panel h-36 animate-pulse" />
            ))}
          </div>
        )}

        {data && (
          <>
            <div>
              <div className="label mb-2">The market this week</div>
              <IndexTiles indices={data.indices} />
            </div>
            <Verdict report={latestReport} />
            <FundGrid funds={data.funds} latest={data.latest} sparks={data.sparks} summaries={summaries} />
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <TrendChart funds={data.funds} snapshots={data.snapshots} />
              </div>
              <Reports reports={data.reports} funds={data.funds} />
            </div>
            <FundManager funds={data.funds} onChange={load} />
            <p className="pb-4 text-center text-[11px] text-faint">
              Index figures use index funds as a stand-in (proxy). “Similar” = average of 10 funds in the same category. Not financial advice.
            </p>
          </>
        )}
      </main>
    </>
  );
}
