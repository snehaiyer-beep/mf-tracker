import { MARKET_INDICES } from "./benchmarks";
import { lastFridayOnOrBefore, todayIST } from "./dates";
import { renderReportEmail, sendReportEmail } from "./email";
import { listFunds } from "./funds";
import { generateReport, type ReportInput } from "./gemini";
import { errorMessage } from "./http";
import { loadSeries, syncMany } from "./nav";
import { recentNews, refreshNews } from "./news";
import { computeReturns } from "./returns";
import { computeSnapshots, historyStart, saveSnapshots, trackedCodes } from "./snapshots";
import { db } from "./supabase";

export type Trigger = "scheduled" | "manual" | "dashboard";

/** Vercel Cron identifies itself with a "vercel-cron" user agent; anything else with the secret is manual. */
export function triggerFrom(req: Request): Trigger {
  return (req.headers.get("user-agent") ?? "").includes("vercel-cron") ? "scheduled" : "manual";
}

/** Log a run for the dashboard's "Last updated" strip and "Automation history". Never fails the job. */
async function logRun(job: "daily" | "weekly", trigger: Trigger, ok: boolean, detail: unknown) {
  try {
    const { error } = await db().from("job_log").insert({ job, trigger, ok, detail });
    if (error) console.error("Logging job run failed", error.message);
  } catch (err) {
    console.error("Logging job run failed", err);
  }
}

/** Daily: refresh the last 30 days of NAVs for everything we track, then store today's news. */
export async function runDaily(trigger: Trigger) {
  try {
    const funds = await listFunds();
    const navs = await syncMany(trackedCodes(funds), 30, 6);
    const news = await refreshNews();
    await logRun("daily", trigger, navs.failed.length === 0, {
      navs_ok: navs.ok,
      navs_failed: navs.failed.length,
      news_source: news.source,
      news_stored: news.stored,
    });
    return { funds: funds.length, navs, news };
  } catch (err) {
    await logRun("daily", trigger, false, { error: errorMessage(err) });
    throw err;
  }
}

/** Weekly: compute snapshots, ask Gemini for a summary, save the report and email it. */
export async function runWeekly(opts: { trigger: Trigger; sendEmail?: boolean }) {
  try {
    return await weekly(opts.trigger, opts.sendEmail ?? true);
  } catch (err) {
    await logRun("weekly", opts.trigger, false, { error: errorMessage(err) });
    throw err;
  }
}

async function weekly(trigger: Trigger, sendEmail: boolean) {
  // Reports are labelled by the week's last trading day (Friday), so reruns land on the same week.
  const asOf = lastFridayOnOrBefore(todayIST());
  const funds = await listFunds();
  if (funds.length === 0) throw new Error("No active funds. Add a fund first.");

  // NAVs are refreshed by the daily cron; the weekly job only reads from the database.
  const series = await loadSeries(trackedCodes(funds), historyStart(asOf));
  const ret = (code: number) => computeReturns(series.get(code) ?? [], asOf);
  const snapshots = computeSnapshots(funds, asOf, series);
  await saveSnapshots(snapshots);

  const indexMoves = MARKET_INDICES.map((b) => ({ index: b.name, wow: ret(b.code).wow }));
  const news = await recentNews(7, 40);

  const input: ReportInput = {
    as_of: asOf,
    funds: funds.map((f, i) => {
      const s = snapshots[i];
      return {
        scheme_code: f.scheme_code,
        name: f.name,
        category: f.category,
        fund: { wow: s.wow, mom: s.mom, ytd: s.ytd },
        benchmark: { name: f.stated_benchmark ?? f.benchmark_name, wow: s.bench_wow, mom: s.bench_mom, ytd: s.bench_ytd },
        category_average: { wow: s.cat_wow, mom: s.cat_mom, ytd: s.cat_ytd },
      };
    }),
    index_moves: indexMoves,
    news_headlines: news.map((n) => ({ title: n.title, source: n.source, date: n.published_at?.slice(0, 10) ?? null })),
  };

  const report = await generateReport(input);
  const marketContext = { index_moves: indexMoves, news: news.slice(0, 15) };

  // Every run is kept as its own row, so re-generating a week adds to the history instead of replacing it.
  const { data: saved, error: repErr } = await db()
    .from("reports")
    .insert({ week_ending: asOf, market_context: marketContext, report, verdict: report.verdict, email_sent: false })
    .select("id")
    .single();
  if (repErr || !saved) throw new Error(`Saving report failed: ${repErr?.message ?? "no row returned"}`);

  let emailError: string | null = null;
  if (sendEmail) {
    try {
      const html = renderReportEmail({ asOf, funds, snapshots, report, indexMoves, news });
      await sendReportEmail(`Fund update (${asOf}): ${report.verdict}`, html);
      await db().from("reports").update({ email_sent: true }).eq("id", saved.id);
    } catch (err) {
      emailError = errorMessage(err);
      console.error(err);
    }
  }

  await logRun("weekly", trigger, !emailError, { as_of: asOf, verdict: report.verdict, email_sent: sendEmail && !emailError, email_error: emailError });
  return { as_of: asOf, funds: funds.length, verdict: report.verdict, email_sent: sendEmail && !emailError, email_error: emailError };
}
