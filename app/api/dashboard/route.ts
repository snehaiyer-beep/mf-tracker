import { NextResponse } from "next/server";
import { addDays, todayIST } from "@/lib/dates";
import { listFunds } from "@/lib/funds";
import { errorMessage } from "@/lib/http";
import { db, type Snapshot } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/** Everything the dashboard needs in one call. */
export async function GET() {
  try {
    const [funds, snaps, reports] = await Promise.all([
      listFunds(),
      db()
        .from("weekly_snapshots")
        .select("*")
        .gte("week_ending", addDays(todayIST(), -400))
        .order("week_ending", { ascending: true })
        .limit(1000),
      db()
        .from("reports")
        .select("id, week_ending, verdict, report, email_sent, created_at")
        .order("week_ending", { ascending: false })
        .limit(20),
    ]);
    if (snaps.error) throw new Error(snaps.error.message);
    if (reports.error) throw new Error(reports.error.message);

    const snapshots = (snaps.data ?? []) as Snapshot[];
    const latestByFund: Record<number, Snapshot> = {};
    for (const s of snapshots) latestByFund[s.scheme_code] = s; // ascending, so last wins

    return NextResponse.json({ funds, snapshots, latest: latestByFund, reports: reports.data ?? [] });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}
