"use client";

import { useCallback, useEffect, useState } from "react";
import { FundManager } from "@/components/FundManager";
import { api } from "@/components/format";
import { Reports, type ReportRow } from "@/components/Reports";
import { ReturnsTable } from "@/components/ReturnsTable";
import { TrendChart } from "@/components/TrendChart";
import type { Fund, Snapshot } from "@/lib/supabase";

type Dashboard = {
  funds: Fund[];
  snapshots: Snapshot[];
  latest: Record<number, Snapshot>;
  reports: ReportRow[];
};

export default function Home() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <main className="mx-auto max-w-4xl space-y-4 px-4 py-6 sm:py-10">
      <header>
        <h1 className="text-2xl font-bold">Mutual fund tracker</h1>
        <p className="text-sm text-slate-500">
          Weekly check-in on your funds against the market and similar funds. Index numbers use index funds as a proxy.
        </p>
      </header>

      {error && <div className="card border-red-200 bg-red-50 text-sm text-red-700">Couldn&apos;t load data: {error}</div>}
      {!data && !error && <div className="card text-sm text-slate-500">Loading…</div>}

      {data && (
        <>
          <FundManager funds={data.funds} onChange={load} />
          <ReturnsTable funds={data.funds} latest={data.latest} />
          <TrendChart funds={data.funds} snapshots={data.snapshots} />
          <Reports reports={data.reports} funds={data.funds} onChange={load} />
        </>
      )}
    </main>
  );
}
