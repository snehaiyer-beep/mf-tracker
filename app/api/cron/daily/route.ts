import { NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/auth";
import { errorMessage } from "@/lib/http";
import { runDaily, triggerFrom } from "@/lib/jobs";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function handle(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json(await runDaily(triggerFrom(req)));
  } catch (err) {
    console.error("Daily cron failed", err);
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
