"use client";

import { toPng } from "html-to-image";
import { useRef, useState } from "react";
import { fundStatus } from "@/lib/status";
import type { Fund, Snapshot } from "@/lib/supabase";
import { prettyName } from "./format";
import type { IndexStat } from "./IndexTiles";
import type { ReportRow } from "./Reports";

type Props = {
  funds: Fund[];
  latest: Record<number, Snapshot>;
  indices: IndexStat[];
  report: ReportRow | undefined;
};

const pct = (v: number | null | undefined) => (typeof v === "number" ? `${v >= 0 ? "▲" : "▼"} ${Math.abs(v).toFixed(2)}%` : "—");
const color = (v: number | null | undefined) => (typeof v !== "number" ? "#8b95b3" : v >= 0 ? "#34d399" : "#fb7185");

const VERDICT_COLOR: Record<string, string> = {
  "No action needed": "#34d399",
  "One fund worth watching": "#fbbf24",
  "Consider reviewing your allocation": "#fb7185",
};

/** Plain-text version for the WhatsApp message itself. */
function summaryText({ funds, latest, report }: Props, asOf: string | undefined): string {
  const lines = [`📊 Fund Pulse: week ending ${asOf ?? "—"}`];
  if (report?.report) {
    lines.push(`Overall: ${report.report.verdict}`, `Why: ${report.report.reason}`);
  }
  lines.push("");
  for (const f of funds) {
    const s = latest[f.scheme_code];
    const st = fundStatus(s);
    lines.push(`• ${prettyName(f.name)}: week ${pct(s?.wow)}, since Jan ${pct(s?.ytd)}${st ? ` (${st.label})` : ""}`);
  }
  lines.push("", "Is this okay? 🙂");
  return lines.join("\n");
}

/**
 * Meera's real workflow from the brief: she screenshots her NAVs and sends them to a CA friend on
 * WhatsApp. This builds a clean 1200×630 image of the week, in the browser (free, no API), and
 * opens the phone's share sheet, or downloads it and opens WhatsApp with a text summary on desktop.
 */
export function ShareCard(props: Props) {
  const { funds, latest, indices, report } = props;
  const cardRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const asOf = Object.values(latest).map((s) => s.week_ending).sort().pop();

  async function makeImage(): Promise<Blob> {
    if (!cardRef.current) throw new Error("Card not ready");
    // System fonts only, so skip font embedding (it fetches stylesheets and can hang); fail after 15 s, never spin forever.
    const render = toPng(cardRef.current, { width: 1200, height: 630, pixelRatio: 1, cacheBust: true, skipFonts: true });
    const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timed out, please try again")), 15_000));
    const dataUrl = await Promise.race([render, timeout]);
    return (await fetch(dataUrl)).blob();
  }

  function download(blob: Blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fund-pulse-${asOf ?? "report"}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  async function share() {
    setBusy(true);
    setNote(null);
    try {
      const blob = await makeImage();
      const text = summaryText(props, asOf);
      const file = new File([blob], `fund-pulse-${asOf ?? "report"}.png`, { type: "image/png" });
      if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], text, title: "Fund Pulse" });
      } else {
        download(blob);
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
        setNote("Image downloaded. Attach it in the WhatsApp chat that just opened.");
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") setNote(`Couldn't create the image: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  async function downloadOnly() {
    setBusy(true);
    setNote(null);
    try {
      download(await makeImage());
    } catch (err) {
      setNote(`Couldn't create the image: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  const verdict = report?.report?.verdict;
  const watch = new Set(report?.report?.watch_scheme_codes ?? []);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={share} disabled={busy || funds.length === 0} className="btn bg-[#25D366] text-[#06281a] shadow-[0_0_20px_rgba(37,211,102,0.35)]">
          {busy ? "Preparing…" : "Share on WhatsApp"}
        </button>
        <button onClick={downloadOnly} disabled={busy || funds.length === 0} className="rounded-lg border border-line px-3 py-2 text-sm text-muted hover:text-ink">
          Download image
        </button>
      </div>
      {note && <p className="mt-2 text-xs text-muted">{note}</p>}

      {/* Off-screen 1200×630 card that becomes the image. Inline styles so the export looks identical everywhere. */}
      <div aria-hidden style={{ position: "fixed", left: -10000, top: 0, pointerEvents: "none" }}>
        <div
          ref={cardRef}
          style={{
            width: 1200,
            height: 630,
            padding: "40px 48px",
            boxSizing: "border-box",
            background: "radial-gradient(900px 400px at 0% 0%, rgba(57,135,229,0.25), transparent 60%), #0b1122",
            color: "#e6eaf5",
            fontFamily: "Inter, Segoe UI, Roboto, sans-serif",
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <div style={{ fontSize: 34, fontWeight: 700 }}>₹ Fund Pulse</div>
            <div style={{ fontSize: 22, color: "#8b95b3" }}>Week ending {asOf ?? "—"}</div>
          </div>

          {verdict && (
            <div style={{ border: `2px solid ${VERDICT_COLOR[verdict] ?? "#3987e5"}`, borderRadius: 18, padding: "14px 22px", background: "rgba(255,255,255,0.03)" }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: VERDICT_COLOR[verdict] ?? "#e6eaf5" }}>{verdict}</div>
              <div style={{ fontSize: 18, color: "#c4cbe0", marginTop: 6, lineHeight: 1.35 }}>{report?.report?.reason}</div>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", fontSize: 16, color: "#8b95b3", textTransform: "uppercase", letterSpacing: 1 }}>
              <div style={{ flex: 1 }}>Fund</div>
              <div style={{ width: 170, textAlign: "right" }}>This week</div>
              <div style={{ width: 170, textAlign: "right" }}>Since Jan</div>
              <div style={{ width: 200, textAlign: "right" }}>Status</div>
            </div>
            {funds.slice(0, 6).map((f) => {
              const s = latest[f.scheme_code];
              const st = fundStatus(s);
              return (
                <div key={f.scheme_code} style={{ display: "flex", alignItems: "center", fontSize: 21, padding: "7px 0", borderTop: "1px solid #1e2a4a" }}>
                  <div style={{ flex: 1, fontWeight: 600 }}>
                    {prettyName(f.name)}
                    {watch.has(f.scheme_code) ? "  👀" : ""}
                  </div>
                  <div style={{ width: 170, textAlign: "right", color: color(s?.wow) }}>{pct(s?.wow)}</div>
                  <div style={{ width: 170, textAlign: "right", color: color(s?.ytd) }}>{pct(s?.ytd)}</div>
                  <div style={{ width: 200, textAlign: "right", color: "#c4cbe0", fontSize: 19 }}>{st?.label ?? "—"}</div>
                </div>
              );
            })}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 17, color: "#8b95b3", whiteSpace: "nowrap", marginTop: "auto" }}>
            <div>
              Market, same week:{" "}
              {indices.map((i, n) => (
                <span key={i.name}>
                  {n > 0 ? " · " : ""}
                  {i.name} <span style={{ color: color(i.wow) }}>{pct(i.wow)}</span>
                </span>
              ))}
            </div>
            <div>Not financial advice</div>
          </div>
        </div>
      </div>
    </div>
  );
}
