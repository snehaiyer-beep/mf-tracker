import { NextResponse } from "next/server";
import { errorMessage } from "@/lib/http";
import { runWeekly } from "@/lib/jobs";
import { db } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const COOLDOWN_MS = 2 * 60 * 1000;

/** "Generate report now" button. No secret (it's called from the browser), so rate-limit it. */
export async function POST() {
  try {
    const { data } = await db()
      .from("reports")
      .select("created_at")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data?.created_at && Date.now() - new Date(data.created_at).getTime() < COOLDOWN_MS) {
      return NextResponse.json({ error: "A report was just generated. Try again in a couple of minutes." }, { status: 429 });
    }
    return NextResponse.json(await runWeekly());
  } catch (err) {
    console.error("Manual report failed", err);
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}
