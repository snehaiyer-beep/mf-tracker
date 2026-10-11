"use client";

import { useEffect, useState } from "react";
import type { Fund } from "@/lib/supabase";
import { api } from "./format";

type SearchResult = { schemeCode: number; schemeName: string };

export function FundManager({ funds, onChange }: { funds: Fund[]; onChange: () => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [busyCode, setBusyCode] = useState<number | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  // Debounced search against mfapi (via our API).
  useEffect(() => {
    const q = query.trim();
    if (q.length < 3 || /^\d+$/.test(q)) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await api<{ results: SearchResult[] }>(`/api/search?q=${encodeURIComponent(q)}`);
        setResults(data.results);
      } catch (err) {
        setMessage({ kind: "error", text: (err as Error).message });
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [query]);

  async function add(code: number) {
    setBusyCode(code);
    setMessage(null);
    try {
      const data = await api<{ fund: Fund; backfill: { ok: number; failed: unknown[] } }>("/api/funds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheme_code: code }),
      });
      const failed = data.backfill.failed.length;
      setMessage({
        kind: "ok",
        text: `Added ${data.fund.name}. Loaded a year of prices for ${data.backfill.ok} schemes${failed ? ` (${failed} failed, the daily job will retry)` : ""}.`,
      });
      setQuery("");
      setResults([]);
      onChange();
    } catch (err) {
      setMessage({ kind: "error", text: (err as Error).message });
    } finally {
      setBusyCode(null);
    }
  }

  async function remove(code: number) {
    if (!confirm("Stop tracking this fund?")) return;
    setBusyCode(code);
    try {
      await api(`/api/funds?scheme_code=${code}`, { method: "DELETE" });
      onChange();
    } catch (err) {
      setMessage({ kind: "error", text: (err as Error).message });
    } finally {
      setBusyCode(null);
    }
  }

  const typedCode = /^\d+$/.test(query.trim()) ? Number(query.trim()) : null;

  return (
    <section className="panel">
      <h2 className="text-base font-semibold">Add or remove funds</h2>
      <p className="mb-3 mt-0.5 text-xs text-muted">Type a scheme code (e.g. 118989) or search by name. A year of prices is loaded automatically.</p>

      <div className="relative">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Scheme code or fund name…"
          className="input"
        />
        {typedCode && (
          <button className="btn mt-2" disabled={busyCode !== null} onClick={() => add(typedCode)}>
            {busyCode === typedCode ? "Adding… (loading a year of prices)" : `Add scheme ${typedCode}`}
          </button>
        )}
        {searching && <p className="mt-2 text-sm text-muted">Searching…</p>}
        {results.length > 0 && (
          <ul className="mt-2 max-h-72 divide-y divide-line overflow-y-auto rounded-lg border border-line">
            {results.map((r) => (
              <li key={r.schemeCode}>
                <button
                  className="flex w-full items-start justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-surface2 disabled:opacity-50"
                  disabled={busyCode !== null}
                  onClick={() => add(r.schemeCode)}
                >
                  <span>{r.schemeName}</span>
                  <span className="shrink-0 text-xs text-faint">
                    {busyCode === r.schemeCode ? "Adding…" : r.schemeCode}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {message && (
        <p className={`mt-3 text-sm ${message.kind === "ok" ? "text-up" : "text-down"}`}>{message.text}</p>
      )}

      <ul className="mt-4 divide-y divide-line">
        {funds.length === 0 && <li className="py-3 text-sm text-muted">No funds yet. Search above to add one.</li>}
        {funds.map((f) => (
          <li key={f.scheme_code} className="flex items-start justify-between gap-3 py-3">
            <div className="min-w-0">
              <div className="text-sm font-medium">{f.name}</div>
              <div className="text-xs text-muted">
                {f.category ?? "Unknown category"} ·{" "}
                {f.benchmark_name ? `${f.benchmark_name} (proxy)` : "no matching index"} · {f.peer_codes?.length ?? 0} similar funds
              </div>
            </div>
            <button className="btn-ghost shrink-0" disabled={busyCode !== null} onClick={() => remove(f.scheme_code)}>
              Remove
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
