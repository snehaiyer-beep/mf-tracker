import { NextResponse } from "next/server";
import { addFund, listFunds, removeFund } from "@/lib/funds";
import { errorMessage } from "@/lib/http";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

function parseCode(value: unknown): number | null {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export async function GET() {
  try {
    return NextResponse.json({ funds: await listFunds() });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  let body: { scheme_code?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const code = parseCode(body.scheme_code);
  if (!code) return NextResponse.json({ error: "scheme_code must be a positive integer" }, { status: 400 });
  try {
    return NextResponse.json(await addFund(code), { status: 201 });
  } catch (err) {
    const message = errorMessage(err);
    const status = message.includes("not found") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(req: Request) {
  const code = parseCode(new URL(req.url).searchParams.get("scheme_code"));
  if (!code) return NextResponse.json({ error: "scheme_code query param required" }, { status: 400 });
  try {
    await removeFund(code);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}
