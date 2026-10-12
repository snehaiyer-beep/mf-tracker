import { NextResponse } from "next/server";
import { addMonths, todayIST } from "@/lib/dates";
import { errorMessage } from "@/lib/http";
import { loadSeries } from "@/lib/nav";
import { db, type Fund } from "@/lib/supabase";
import { computeTrend, type TrendRange } from "@/lib/trend";

export const dynamic = "force-dynamic";

const RANGES: TrendRange[] = ["week", "month", "year"];

/** GET /api/trend?scheme_code=118989&range=week|month|year */
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

    // 13 months back covers the year view plus a buffer for holidays at the start.
    const series = await loadSeries(
      [fund.scheme_code, ...(fund.peer_codes ?? []), ...(fund.benchmark_code ? [fund.benchmark_code] : [])],
      addMonths(todayIST(), -13),
    );
    const trend = computeTrend(
      series.get(fund.scheme_code) ?? [],
      fund.benchmark_code ? (series.get(fund.benchmark_code) ?? []) : null,
      (fund.peer_codes ?? []).map((c) => series.get(c) ?? []),
      range,
    );
    return NextResponse.json({ ...trend, benchmark_name: fund.benchmark_name });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}
