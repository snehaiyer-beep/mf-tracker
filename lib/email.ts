import { Resend } from "resend";
import type { AiReport } from "./gemini";
import type { NewsItem } from "./news";
import { requireEnv } from "./env";
import type { Fund, Snapshot } from "./supabase";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function pct(v: number | null): string {
  if (v === null || v === undefined) return '<span style="color:#9ca3af">—</span>';
  const color = v >= 0 ? "#15803d" : "#b91c1c";
  return `<span style="color:${color}">${v >= 0 ? "+" : ""}${v.toFixed(2)}%</span>`;
}

const VERDICT_COLORS: Record<string, string> = {
  "No action needed": "#dcfce7",
  "One fund worth watching": "#fef9c3",
  "Consider reviewing your allocation": "#fee2e2",
};

export function renderReportEmail(opts: {
  asOf: string;
  funds: Fund[];
  snapshots: Snapshot[];
  report: AiReport;
  indexMoves: { index: string; wow: number | null }[];
  news: NewsItem[];
}): string {
  const { asOf, funds, snapshots, report, indexMoves, news } = opts;
  const snapByCode = new Map(snapshots.map((s) => [s.scheme_code, s]));
  const summaryByCode = new Map(report.funds.map((f) => [f.scheme_code, f.summary]));
  const td = 'style="padding:4px 8px;border-bottom:1px solid #e5e7eb;font-size:13px"';

  const fundBlocks = funds
    .map((f) => {
      const s = snapByCode.get(f.scheme_code);
      const row = (label: string, a?: number | null, b?: number | null, c?: number | null) =>
        `<tr><td ${td}>${label}</td><td ${td}>${pct(a ?? null)}</td><td ${td}>${pct(b ?? null)}</td><td ${td}>${pct(c ?? null)}</td></tr>`;
      return `
      <div style="margin:0 0 20px;padding:16px;border:1px solid #e5e7eb;border-radius:10px">
        <div style="font-weight:600;font-size:15px">${esc(f.name)}</div>
        <div style="color:#6b7280;font-size:12px;margin-bottom:8px">${esc(f.category ?? "")}</div>
        <p style="font-size:14px;line-height:1.5;margin:0 0 10px">${esc(summaryByCode.get(f.scheme_code) ?? "")}</p>
        <table style="border-collapse:collapse;width:100%">
          <tr><th ${td} align="left"></th><th ${td} align="left">Week</th><th ${td} align="left">Month</th><th ${td} align="left">Since Jan</th></tr>
          ${row("This fund", s?.wow, s?.mom, s?.ytd)}
          ${row(`Market: ${esc(f.benchmark_name ?? "n/a")} (proxy)`, s?.bench_wow, s?.bench_mom, s?.bench_ytd)}
          ${row("Similar funds (avg)", s?.cat_wow, s?.cat_mom, s?.cat_ytd)}
        </table>
      </div>`;
    })
    .join("");

  const indexList = indexMoves
    .map((m) => `<li>${esc(m.index)}: ${pct(m.wow)} this week</li>`)
    .join("");

  const newsList = news
    .slice(0, 6)
    .map((n) => `<li><a href="${esc(n.link)}" style="color:#1d4ed8">${esc(n.title)}</a>${n.source ? ` <span style="color:#6b7280">(${esc(n.source)})</span>` : ""}</li>`)
    .join("");

  return `<!doctype html><html><body style="margin:0;background:#f9fafb;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#111827">
  <div style="max-width:640px;margin:0 auto;padding:24px;background:#ffffff">
    <h1 style="font-size:20px;margin:0 0 4px">Your weekly fund update</h1>
    <div style="color:#6b7280;font-size:13px;margin-bottom:16px">Data as of ${esc(asOf)}</div>
    <div style="background:${VERDICT_COLORS[report.verdict] ?? "#f3f4f6"};padding:14px 16px;border-radius:10px;margin-bottom:20px">
      <div style="font-weight:700;font-size:16px">${esc(report.verdict)}</div>
      <div style="font-size:14px;margin-top:4px">${esc(report.reason)}</div>
    </div>
    ${fundBlocks}
    <h2 style="font-size:15px;margin:24px 0 6px">The market this week (index-fund proxies)</h2>
    <ul style="font-size:13px;padding-left:18px;margin:0">${indexList}</ul>
    ${newsList ? `<h2 style="font-size:15px;margin:20px 0 6px">Headlines</h2><ul style="font-size:13px;padding-left:18px;margin:0">${newsList}</ul>` : ""}
    <p style="color:#9ca3af;font-size:11px;margin-top:24px">Market and category numbers use index funds and peer averages as stand-ins. This is not financial advice.</p>
  </div></body></html>`;
}

export async function sendReportEmail(subject: string, html: string): Promise<void> {
  const resend = new Resend(requireEnv("RESEND_API_KEY"));
  const to = requireEnv("REPORT_EMAIL_TO")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const from = process.env.RESEND_FROM || "MF Tracker <onboarding@resend.dev>";
  try {
    const { error } = await resend.emails.send({ from, to, subject, html });
    if (error) throw new Error(error.message);
  } catch (err) {
    throw new Error(`Resend failed: ${err instanceof Error ? err.message : err}`);
  }
}
