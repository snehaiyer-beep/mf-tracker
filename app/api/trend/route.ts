import { NextResponse } from "next/server";
import { addMonths, todayIST } from "@/lib/dates";
import { errorMessage } from "@/lib/http";
import { loadSeries } from "@/lib/nav";
import { db, type Fund } from "@/lib/supabase";
import { computePeriodBars, computeYearLine, type TrendRange } from "@/lib/trend";

export const dynamic = "force-dynamic";

const RANGES: TrendRange[] = ["week", "month", "year"];

/**
 * GET /api/trend?scheme_code=118989&range=week|month|year
 * week/month: the last 12 weeks or months as bars; year: a growth line.
 */
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const code = Number(params.get("scheme_code"));
  const range = (params.get("range") ?? "year") as TrendRange;
  if (!Number.isInteger(code) || code <= 0) return NextResponse.json({ error: "scheme_code required" }, { status: 400 });
  if (!RANGES.includes(range)) return NextResponse.json({ error: "range must be week, month or year" }, { status: 400 });

  try {
    const { data, error } = await db().from("funds").select("*").eq("scheme_code", code).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return NextResponse.json({ error: "Fund not found" }, { status: 404 });
    const fund = data as Fund;

    // 14 months back covers 12 full months plus the month before the first one, with a holiday buffer.
    const series = await loadSeries(
      [fund.scheme_code, ...(fund.peer_codes ?? []), ...(fund.benchmark_code ? [fund.benchmark_code] : [])],
      addMonths(todayIST(), -14),
    );
    const own = series.get(fund.scheme_code) ?? [];
    const index = fund.benchmark_code ? (series.get(fund.benchmark_code) ?? []) : null;
    const peers = (fund.peer_codes ?? []).map((c) => series.get(c) ?? []);
    if (range === "year") {
      return NextResponse.json({ kind: "line", ...computeYearLine(own, index, peers), benchmark_name: fund.benchmark_name });
    }
    return NextResponse.json({ kind: "bars", bars: computePeriodBars(own, index, peers, range), benchmark_name: fund.benchmark_name });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}
