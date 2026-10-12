import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { addMonths, fromAmfiDate, fromMfapiDate, lastFridayOnOrBefore, previousYearEnd } from "../lib/dates";
import type { NavPoint } from "../lib/mfapi";
import { average, changeBetween, computeReturns, getNavOnOrBefore, pctChange } from "../lib/returns";

/** Weekday-only NAVs starting at 100, rising 0.1 per trading day, with a holiday on 2026-10-02. */
function series(from: string, to: string): NavPoint[] {
  const out: NavPoint[] = [];
  let nav = 100;
  for (let d = new Date(`${from}T00:00:00Z`); d <= new Date(`${to}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1)) {
    const iso = d.toISOString().slice(0, 10);
    const day = d.getUTCDay();
    if (day === 0 || day === 6 || iso === "2026-10-02") continue;
    out.push({ date: iso, nav: Math.round(nav * 1000) / 1000 });
    nav += 0.1;
  }
  return out;
}

describe("dates", () => {
  it("clamps month arithmetic to the end of shorter months", () => {
    assert.equal(addMonths("2026-03-31", -1), "2026-02-28");
    assert.equal(addMonths("2024-03-31", -1), "2024-02-29");
    assert.equal(addMonths("2026-10-09", -12), "2025-10-09");
  });
  it("finds the last Friday on or before a date", () => {
    assert.equal(lastFridayOnOrBefore("2026-10-09"), "2026-10-09"); // Friday
    assert.equal(lastFridayOnOrBefore("2026-10-11"), "2026-10-09"); // Sunday
    assert.equal(lastFridayOnOrBefore("2026-10-15"), "2026-10-09"); // Thursday
  });
  it("parses source date formats", () => {
    assert.equal(fromMfapiDate("09-10-2026"), "2026-10-09");
    assert.equal(fromAmfiDate("09-Oct-2026"), "2026-10-09");
    assert.equal(fromAmfiDate("not a date"), null);
    assert.equal(previousYearEnd("2026-10-09"), "2025-12-31");
  });
});

describe("getNavOnOrBefore", () => {
  const s = series("2026-09-01", "2026-10-09");
  it("returns the exact day when it is a trading day", () => {
    assert.equal(getNavOnOrBefore(s, "2026-10-09")?.date, "2026-10-09");
  });
  it("steps back over weekends and holidays", () => {
    assert.equal(getNavOnOrBefore(s, "2026-10-04")?.date, "2026-10-01"); // Sun -> skips Fri 2 Oct holiday -> Thu
  });
  it("returns null before the series starts or when the gap is too long", () => {
    assert.equal(getNavOnOrBefore(s, "2026-08-15"), null);
    assert.equal(getNavOnOrBefore(s, "2026-11-30"), null); // >10 days after last NAV
  });
});

describe("returns maths", () => {
  it("uses (current / past - 1) * 100", () => {
    assert.equal(pctChange(110, 100).toFixed(6), "10.000000");
    assert.equal(pctChange(90, 100).toFixed(6), "-10.000000");
  });
  it("computes WoW, MoM and YTD against the right past NAVs", () => {
    const s = series("2025-12-01", "2026-10-09");
    const r = computeReturns(s, "2026-10-09");
    const nav = (d: string) => getNavOnOrBefore(s, d)!.nav;
    const exp = (past: string) => Math.round(pctChange(nav("2026-10-09"), nav(past)) * 100) / 100;
    assert.equal(r.wow, exp("2026-10-02")); // holiday -> uses 1 Oct
    assert.equal(r.mom, exp("2026-09-09"));
    assert.equal(r.ytd, exp("2025-12-31"));
  });
  it("returns nulls when there is no data", () => {
    assert.deepEqual(computeReturns([], "2026-10-09"), { wow: null, mom: null, ytd: null });
  });
  it("averages only real numbers", () => {
    assert.equal(average([1, null, 3]), 2);
    assert.equal(average([null, null]), null);
  });
  it("changeBetween is null when both dates land on the same NAV", () => {
    const s = series("2026-09-01", "2026-10-09");
    assert.equal(changeBetween(s, "2026-10-03", "2026-10-04"), null);
    assert.ok((changeBetween(s, "2026-09-01", "2026-10-09") ?? 0) > 0);
  });
});
