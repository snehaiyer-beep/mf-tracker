import { prettyName } from "./format";
import type { Fund } from "@/lib/supabase";
import type { ReportRow } from "./Reports";

const STYLE: Record<string, { ring: string; icon: string; glow: string }> = {
  "No action needed": { ring: "border-up/40", icon: "✓", glow: "shadow-[0_0_40px_-12px_rgba(52,211,153,0.5)]" },
  "One fund worth watching": { ring: "border-amber-400/40", icon: "!", glow: "shadow-[0_0_40px_-12px_rgba(251,191,36,0.5)]" },
  "Consider reviewing your allocation": { ring: "border-down/40", icon: "⚠", glow: "shadow-[0_0_40px_-12px_rgba(251,113,133,0.5)]" },
};

const ICON_COLOR: Record<string, string> = {
  "No action needed": "bg-up/15 text-up",
  "One fund worth watching": "bg-amber-400/15 text-amber-300",
  "Consider reviewing your allocation": "bg-down/15 text-down",
};

export function Verdict({ report, funds }: { report: ReportRow | undefined; funds: Fund[] }) {
  if (!report?.report) {
    return (
      <section className="panel flex items-center gap-3 border-dashed text-sm text-muted">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface2 text-faint">?</span>
        No report yet. One arrives every Saturday at 8 AM IST, or use “Generate report”.
      </section>
    );
  }
  const v = report.report.verdict;
  const s = STYLE[v] ?? STYLE["No action needed"];
  const nameByCode = new Map(funds.map((f) => [f.scheme_code, prettyName(f.name)]));
  const watched = (report.report.watch_scheme_codes ?? []).map((c) => nameByCode.get(c) ?? `Scheme ${c}`);
  return (
    <section className={`panel flex items-start gap-4 ${s.ring} ${s.glow}`}>
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg font-bold ${ICON_COLOR[v] ?? ""}`}>
        {s.icon}
      </span>
      <div className="min-w-0">
        <div className="label">Overall verdict · week of {report.week_ending}</div>
        <div className="mt-0.5 text-lg font-semibold">{v}</div>
        {watched.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {watched.map((name) => (
              <span key={name} className="rounded-full border border-amber-400/40 bg-amber-400/10 px-2.5 py-0.5 text-xs font-medium text-amber-200">
                👀 {name}
              </span>
            ))}
          </div>
        )}
        <p className="mt-2 text-sm text-muted">{report.report.reason}</p>
      </div>
    </section>
  );
}
