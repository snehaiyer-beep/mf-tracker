import { ALL_BENCHMARKS } from "./benchmarks";
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

/** Record when a job ran, for the dashboard's "Last updated" panel. Never fails the job. */
async function recordRun(job: "daily" | "weekly", ok: boolean, detail: unknown) {
  try {
    await db().from("job_runs").upsert({ job, ran_at: new Date().toISOString(), ok, detail }, { onConflict: "job" });
  } catch (err) {
    console.error("Recording job run failed", err);
  }
}

/** Daily: refresh the last 30 days of NAVs for everything we track, then store today's news. */
export async function runDaily() {
  const funds = await listFunds();
  const navs = await syncMany(trackedCodes(funds), 30, 6);
  const news = await refreshNews();
  const result = { funds: funds.length, navs, news };
  await recordRun("daily", navs.failed.length === 0, { navs_ok: navs.ok, navs_failed: navs.failed.length, news_source: news.source, news_stored: news.stored });
  return result;
}

/** Weekly: compute snapshots, ask Gemini for a summary, save the report and email it. */
export async function runWeekly(opts: { sendEmail?: boolean } = {}) {
  const sendEmail = opts.sendEmail ?? true;
  // Reports are labelled by the week's last trading day (Friday), so reruns land on the same week.
  const asOf = lastFridayOnOrBefore(todayIST());
  const funds = await listFunds();
  if (funds.length === 0) throw new Error("No active funds. Add a fund first.");

  // NAVs are refreshed by the daily cron; the weekly job only reads from the database.
  const series = await loadSeries(trackedCodes(funds), historyStart(asOf));
  const ret = (code: number) => computeReturns(series.get(code) ?? [], asOf);
  const snapshots = computeSnapshots(funds, asOf, series);
  await saveSnapshots(snapshots);

  const indexMoves = ALL_BENCHMARKS.map((b) => ({ index: b.name, wow: ret(b.code).wow }));
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
        benchmark: { name: f.benchmark_name, wow: s.bench_wow, mom: s.bench_mom, ytd: s.bench_ytd },
        category_average: { wow: s.cat_wow, mom: s.cat_mom, ytd: s.cat_ytd },
      };
    }),
    index_moves: indexMoves,
    news_headlines: news.map((n) => ({ title: n.title, source: n.source, date: n.published_at?.slice(0, 10) ?? null })),
  };

  const report = await generateReport(input);
  const marketContext = { index_moves: indexMoves, news: news.slice(0, 15) };

  const { error: repErr } = await db().from("reports").upsert(
    {
      week_ending: asOf,
      market_context: marketContext,
      report,
      verdict: report.verdict,
      email_sent: false,
      created_at: new Date().toISOString(),
    },
    { onConflict: "week_ending" },
  );
  if (repErr) throw new Error(`Saving report failed: ${repErr.message}`);

  let emailError: string | null = null;
  if (sendEmail) {
    try {
      const html = renderReportEmail({ asOf, funds, snapshots, report, indexMoves, news });
      await sendReportEmail(`Fund update (${asOf}): ${report.verdict}`, html);
      await db().from("reports").update({ email_sent: true }).eq("week_ending", asOf);
    } catch (err) {
      emailError = errorMessage(err);
      console.error(err);
    }
  }

  await recordRun("weekly", !emailError, { as_of: asOf, verdict: report.verdict, email_sent: sendEmail && !emailError });
  return { as_of: asOf, funds: funds.length, verdict: report.verdict, email_sent: sendEmail && !emailError, email_error: emailError };
}
