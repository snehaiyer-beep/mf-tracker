"use client";

import { prettyName } from "./format";
import { useState } from "react";
import { fundStatus, STATUS_ICON, STATUS_STYLE, type FundStatus } from "@/lib/status";
import type { Fund, Snapshot } from "@/lib/supabase";
import type { IndexStat } from "./IndexTiles";

type Props = {
  funds: Fund[];
  latest: Record<number, Snapshot>;
  indices: IndexStat[];
  verdict: string | null;
};

const shortName = (f: Fund) => prettyName(f.name);

/** "Your week in plain words": built from the numbers, no jargon, no AI call. */
function WeekInWords({ funds, latest, indices, verdict }: Props) {
  const withData = funds.filter((f) => latest[f.scheme_code]?.wow !== null && latest[f.scheme_code]);
  if (withData.length === 0) return null;
  const up = withData.filter((f) => (latest[f.scheme_code].wow ?? 0) >= 0).length;
  const marketUp = indices.filter((i) => (i.wow ?? 0) >= 0).length;
  const best = [...withData].sort((a, b) => (latest[b.scheme_code].ytd ?? -999) - (latest[a.scheme_code].ytd ?? -999))[0];
  const lagging = withData.filter((f) => {
    const st = fundStatus(latest[f.scheme_code]);
    return st?.key === "lagging" || st?.key === "watch";
  });

  return (
    <div className="rounded-xl border border-accent/30 bg-accent/10 p-3 text-sm leading-relaxed">
      <div className="label mb-1 text-sky-300">Your week in plain words</div>
      <ul className="list-disc space-y-1 pl-4 text-ink/90">
        <li>
          {up} of your {withData.length} funds went up this week.{" "}
          {marketUp >= 2 ? "The market was mostly up too." : marketUp === 1 ? "The market was mixed." : "The market was mostly down too."}
        </li>
        {best && <li>Best since January: {shortName(best)} ({(latest[best.scheme_code].ytd ?? 0).toFixed(1)}%).</li>}
        {lagging.length > 0 ? (
          <li>Falling behind similar funds: {lagging.map(shortName).join(", ")}. Not an emergency, just worth checking again in a few weeks.</li>
        ) : (
          <li>None of your funds is falling behind similar funds.</li>
        )}
        {verdict && <li>Bottom line: {verdict.toLowerCase()}.</li>}
      </ul>
    </div>
  );
}

function Section({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  return (
    <details open={defaultOpen} className="group border-b border-line py-3 last:border-0">
      <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold">
        {title}
        <span className="text-faint transition group-open:rotate-90">›</span>
      </summary>
      <div className="mt-2 space-y-2 text-[13px] leading-relaxed text-muted">{children}</div>
    </details>
  );
}

function Pill({ k, label }: { k: FundStatus["key"]; label: string }) {
  return (
    <span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${STATUS_STYLE[k]}`}>
      {STATUS_ICON[k]} {label}
    </span>
  );
}

const GLOSSARY: [string, string][] = [
  ["Mutual fund", "A pot of money from many people, invested by a professional in many companies at once."],
  ["SIP", "Systematic Investment Plan: putting in a fixed amount every month, automatically."],
  ["NAV", "The price of one unit of a fund on a given day. A higher NAV is not \"expensive\"; only the change matters."],
  ["Return", "How much your money grew or shrank, as a percentage. +5% on ₹10,000 is ₹500 more."],
  ["Index", "A scoreboard for a group of companies. Nifty 50 tracks India's 50 biggest companies."],
  ["Index fund", "A fund that simply copies an index instead of picking companies. Low cost, no star manager."],
  ["Category", "Funds of the same type (e.g. all small-company funds). Comparing within a category is fair."],
  ["Debt fund", "Lends money to the government and companies. Slow and steady, small ups and downs."],
  ["Fund of funds", "A fund that invests in other funds, often abroad (here: US technology companies)."],
  ["Direct · Growth", "No middleman commission (Direct), and profits stay invested instead of being paid out (Growth)."],
];

function GuideBody(props: Props) {
  return (
    <div className="space-y-3">
      <WeekInWords {...props} />

      <div className="rounded-xl border border-line bg-surface2/60 p-3 text-[13px] leading-relaxed">
        <div className="mb-1 font-semibold">Short on time? Read 3 things</div>
        <ol className="list-decimal space-y-1 pl-4 text-muted">
          <li>
            The <span className="text-ink">verdict</span> box: one line telling you whether to do anything.
          </li>
          <li>
            The <span className="text-ink">status label</span> next to each fund.
          </li>
          <li>
            The <span className="text-ink">summary</span> under each fund, written in plain words.
          </li>
        </ol>
      </div>

      <div>
        <Section title="The market this week" defaultOpen>
          <p>The three tiles show how the Indian stock market moved overall, so you can tell whether a dip was <em>everyone</em> or just <em>your fund</em>.</p>
          <p>
            <span className="text-ink">Nifty 50</span>: India&apos;s 50 biggest companies (think Reliance, HDFC Bank, Infosys).{" "}
            <span className="text-ink">Midcap 150</span>: medium-sized companies. <span className="text-ink">Smallcap 100</span>: smaller companies,
            which swing up and down more.
          </p>
          <p>
            <span className="text-up">▲ green</span> means it went up, <span className="text-down">▼ red</span> means it went down. &quot;Proxy&quot; means
            we read the number from a fund that copies the index; it&apos;s practically the same.
          </p>
        </Section>

        <Section title="The verdict">
          <p>Written each Saturday after looking at all your funds together. There are only three possible messages:</p>
          <p>
            <span className="text-up">✓ No action needed</span>: relax, everything moved with the market.
          </p>
          <p>
            <span className="text-amber-300">! One fund worth watching</span>: one fund is falling behind funds like it. Don&apos;t sell; check again in a few
            weeks.
          </p>
          <p>
            <span className="text-down">⚠ Consider reviewing</span>: several funds are lagging. A good time to talk to an adviser.
          </p>
        </Section>

        <Section title="Status labels">
          <p>Each fund is compared with the average of 10 similar funds since January:</p>
          <div className="space-y-1.5">
            <div><Pill k="ahead" label="Doing well" /> 2+ points ahead of similar funds</div>
            <div><Pill k="ok" label="On track" /> within 2 points: doing its job</div>
            <div><Pill k="watch" label="Keep an eye" /> 2–5 points behind</div>
            <div><Pill k="lagging" label="Lagging" /> more than 5 points behind</div>
          </div>
        </Section>

        <Section title="Reading the fund table">
          <p>
            <span className="text-ink">Week / Month / Since Jan</span>: how much the fund grew or shrank over that time.
          </p>
          <p>
            Under each number: <span style={{ color: "var(--series-index)" }}>● Index</span> is the market your fund is compared with, and{" "}
            <span style={{ color: "var(--series-cat)" }}>● Similar</span> is the average of 10 funds of the same type.
          </p>
          <p>
            <span className="text-ink">The rule of thumb:</span> if your fund&apos;s number is close to &quot;Similar&quot;, it&apos;s doing its job, even if
            the number is red. When the whole market falls, good funds fall too.
          </p>
          <p>The squiggly line is the fund&apos;s price over the last 90 days.</p>
        </Section>

        <Section title="Reading the chart">
          <p>
            <span className="text-ink">Week</span>: one group of bars for each of the last 12 weeks. A bar above the middle line means it went up that
            week; below means it went down.
          </p>
          <p>
            <span className="text-ink">Month</span>: the same, for each of the last 12 months.
          </p>
          <p>
            <span className="text-ink">Year</span>: a line showing how ₹100 put in a year ago would have grown. All lines start at 0%, so the higher line
            grew more.
          </p>
          <p>
            In every view, <span style={{ color: "var(--series-fund)" }}>blue</span> is your fund,{" "}
            <span style={{ color: "var(--series-index)" }}>orange</span> is the market, <span style={{ color: "var(--series-cat)" }}>green</span> is
            similar funds.
          </p>
          <p>
            <span className="text-ink">What to look for:</span> blue moving with the others means all is normal. Blue staying <em>below</em> green week after week is
            worth a conversation. One bad week is not.
          </p>
        </Section>

        <Section title="Good habits for SIP investors">
          <p>Ups and downs are normal. A 3–5% drop in a month happens several times a year.</p>
          <p>With a SIP, a falling market means your fixed monthly amount buys more units cheaply. That helps you later.</p>
          <p>Judge a fund over 1–3 years, not one week. Stopping SIPs during a dip is the most common mistake.</p>
          <p>Debt funds are for stability, equity funds for growth. Having both is by design.</p>
        </Section>

        <Section title="Glossary">
          <dl className="space-y-2">
            {GLOSSARY.map(([term, def]) => (
              <div key={term}>
                <dt className="text-ink">{term}</dt>
                <dd>{def}</dd>
              </div>
            ))}
          </dl>
        </Section>
      </div>

      <p className="text-[11px] leading-relaxed text-faint">
        This dashboard explains how your funds are doing. It isn&apos;t financial advice and never tells you what to buy or sell.
      </p>
    </div>
  );
}

/** Pinned sidebar on large screens; a slide-over drawer opened by a floating button on phones. */
export function Guide(props: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <aside className="hidden lg:block">
        <div className="panel sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto">
          <h2 className="mb-3 text-base font-semibold">How to read this</h2>
          <GuideBody {...props} />
        </div>
      </aside>

      <button
        onClick={() => setOpen(true)}
        className="btn fixed bottom-4 right-4 z-20 rounded-full px-4 py-3 lg:hidden"
        aria-label="How to read this dashboard"
      >
        ? How to read this
      </button>
      {open && (
        <div className="fixed inset-0 z-30 lg:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 right-0 w-[min(92vw,380px)] overflow-y-auto border-l border-line bg-surface p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold">How to read this</h2>
              <button onClick={() => setOpen(false)} className="btn-ghost text-lg" aria-label="Close">
                ✕
              </button>
            </div>
            <GuideBody {...props} />
          </div>
        </div>
      )}
    </>
  );
}
