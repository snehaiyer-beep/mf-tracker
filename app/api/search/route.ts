import { NextResponse } from "next/server";
import { errorMessage } from "@/lib/http";
import { searchSchemes } from "@/lib/mfapi";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 3) return NextResponse.json({ results: [] });
  try {
    const results = await searchSchemes(q);
    // Most people want Direct Growth plans; list those first.
    const score = (name: string) => {
      const n = name.toLowerCase();
      return (n.includes("direct") ? 0 : 2) + (n.includes("growth") ? 0 : 1);
    };
    results.sort((a, b) => score(a.schemeName) - score(b.schemeName));
    return NextResponse.json({ results: results.slice(0, 25) });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 502 });
  }
}
