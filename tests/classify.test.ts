import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { categoryKey, parseNavAll } from "../lib/amfi";
import { pickBenchmark } from "../lib/benchmarks";
import { fundStatus } from "../lib/status";
import type { Snapshot } from "../lib/supabase";
import type { NavPoint } from "../lib/mfapi";
import { computePeriodBars, computeYearLine } from "../lib/trend";

describe("AMFI category matching", () => {
  it("treats old and new header spellings as the same category", () => {
    assert.equal(categoryKey("Equity Scheme - ELSS"), categoryKey("Equity Schemes - ELSS- Tax Saver Fund"));
    assert.equal(categoryKey("Debt Scheme - Short Duration Fund"), categoryKey("Income/Debt Oriented Schemes - Short Term Fund"));
    assert.notEqual(categoryKey("Debt Scheme - Short Duration Fund"), categoryKey("Debt Scheme - Ultra Short Duration Fund"));
  });
  it("keeps only Direct Growth rows from open-ended categories", () => {
    const text = [
      "Open Ended Schemes(Equity Scheme - Mid Cap Fund)",
      "",
      "HDFC Mutual Fund",
      "118989;INF179K01XQ0;-;HDFC Mid Cap Fund;Direct Plan;Growth Option;200.1;09-Oct-2026",
      "118990;INF179K01XR8;-;HDFC Mid Cap Fund;Direct Plan;IDCW;50.1;09-Oct-2026",
      "105758;INF179K01CR2;-;HDFC Mid Cap Fund;Regular Plan;Growth;180.1;09-Oct-2026",
      "Close Ended Schemes(Growth)",
      "999999;X;-;Some Close Ended Fund;Direct Plan;Growth;10;09-Oct-2026",
    ].join("\n");
    const rows = parseNavAll(text);
    assert.deepEqual(rows.map((r) => r.code), [118989]);
    assert.equal(rows[0].date, "2026-10-09");
  });
});

describe("benchmark selection", () => {
  const pick = (cat: string, name: string) => pickBenchmark(cat, name);
  it("matches each of Meera's fund types to its stated benchmark", () => {
    assert.equal(pick("Other Scheme - Index Funds", "HDFC Nifty 50 Index Fund - Direct Plan - Growth Option").stated, "NIFTY 50 TRI");
    assert.equal(pick("Equity Scheme - Mid Cap Fund", "HDFC Mid Cap Fund - Direct Plan - Growth").proxy?.key, "midcap150");
    assert.equal(pick("Equity Scheme - Small Cap Fund", "SBI SMALL CAP FUND - Direct Plan - Growth").proxy?.key, "smallcap250");
    assert.equal(pick("Debt Scheme - Short Duration Fund", "ICICI Prudential Short Term Fund").stated, "CRISIL Short Duration Debt A-II Index");
    assert.equal(pick("Other Scheme - FoF Overseas", "Edelweiss US Technology Equity Fund of Fund").proxy?.key, "nasdaq100");
  });
  it("gives cash-like funds no index stand-in", () => {
    assert.equal(pick("Debt Scheme - Liquid Fund", "Some Liquid Fund").proxy, null);
  });
});

describe("fund status labels", () => {
  const snap = (ytd: number, cat: number) => ({ ytd, cat_ytd: cat }) as Snapshot;
  it("labels by points ahead of or behind similar funds since January", () => {
    assert.equal(fundStatus(snap(12, 9))?.key, "ahead");
    assert.equal(fundStatus(snap(9.5, 9))?.key, "ok");
    assert.equal(fundStatus(snap(5.57, 9.14))?.key, "watch");
    assert.equal(fundStatus(snap(2, 9))?.key, "lagging");
    assert.equal(fundStatus(undefined), null);
  });
});

describe("chart data", () => {
  const s: NavPoint[] = [];
  let nav = 100;
  for (let d = new Date("2025-09-01T00:00:00Z"); d <= new Date("2026-10-09T00:00:00Z"); d.setUTCDate(d.getUTCDate() + 1)) {
    if (d.getUTCDay() === 0 || d.getUTCDay() === 6) continue;
    s.push({ date: d.toISOString().slice(0, 10), nav });
    nav *= 1.0005;
  }
  it("week view returns 12 Friday-to-Friday bars ending on the last Friday", () => {
    const bars = computePeriodBars(s, s, [s], "week");
    assert.equal(bars.length, 12);
    assert.equal(bars.at(-1)?.end, "2026-10-09");
    assert.ok(bars.every((b) => (b.fund ?? 0) > 0));
  });
  it("month view flags the running month as partial", () => {
    const bars = computePeriodBars(s, null, [s], "month");
    assert.equal(bars.length, 12);
    assert.equal(bars.at(-1)?.partial, true);
    assert.equal(bars.at(-1)?.index, null);
  });
  it("year line starts at 0%", () => {
    const line = computeYearLine(s, s, [s]);
    assert.equal(line.points[0].fund, 0);
    assert.ok((line.points.at(-1)?.fund ?? 0) > 0);
  });
});
