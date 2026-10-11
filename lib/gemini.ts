import { GoogleGenAI, Type, type Schema } from "@google/genai";
import { requireEnv } from "./env";

export const VERDICTS = [
  "No action needed",
  "One fund worth watching",
  "Consider reviewing your allocation",
] as const;
export type Verdict = (typeof VERDICTS)[number];

export type AiReport = {
  funds: { scheme_code: number; summary: string }[];
  verdict: Verdict;
  /** scheme_codes of the fund(s) behind the verdict; empty when no action is needed. */
  watch_scheme_codes: number[];
  reason: string;
};

/** Everything the model sees. Plain numbers only; it must not invent data. */
export type ReportInput = {
  as_of: string;
  funds: {
    scheme_code: number;
    name: string;
    category: string | null;
    fund: { wow: number | null; mom: number | null; ytd: number | null };
    benchmark: { name: string | null; wow: number | null; mom: number | null; ytd: number | null };
    category_average: { wow: number | null; mom: number | null; ytd: number | null };
  }[];
  index_moves: { index: string; wow: number | null }[];
  news_headlines: { title: string; source: string | null; date: string | null }[];
};

const responseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    funds: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          scheme_code: { type: Type.INTEGER },
          summary: { type: Type.STRING },
        },
        required: ["scheme_code", "summary"],
        propertyOrdering: ["scheme_code", "summary"],
      },
    },
    verdict: { type: Type.STRING, format: "enum", enum: [...VERDICTS] },
    watch_scheme_codes: { type: Type.ARRAY, items: { type: Type.INTEGER } },
    reason: { type: Type.STRING },
  },
  required: ["funds", "verdict", "watch_scheme_codes", "reason"],
  propertyOrdering: ["funds", "verdict", "watch_scheme_codes", "reason"],
};

const SYSTEM_PROMPT = `You write a short weekly update on someone's mutual funds.
The reader is NOT a finance person. Use everyday words. No jargon: do not say "alpha", "beta",
"basis points", "drawdown", "outperform", "underperform", "volatility", "benchmark" or "YTD".
Say "this week", "this month", "since January", "the overall market", "similar funds".

All returns are percentages. "wow" = this week, "mom" = this month (last 1 month), "ytd" = since 1 January.
The market comparison numbers come from index funds used as a stand-in for the index.
index_moves covers the three indices tracked: Nifty 50 (large companies), Nifty Midcap 150 (mid-sized)
and Nifty Smallcap 100 (small companies).
null means data was not available; never invent numbers.

For EACH fund write exactly 3 sentences:
1) how the fund did (this week, and the bigger picture since January);
2) how that compares with the overall market and with similar funds. If benchmark.name is null, there is
   no matching market index for that kind of fund (e.g. a bond fund or an overseas fund): compare it only
   with similar funds;
3) the most likely market reason, based only on the index moves and news headlines given. If the news doesn't explain it, say the move looks like normal market ups and downs.

Then pick ONE verdict:
- "No action needed": funds roughly in line with the market and similar funds.
- "One fund worth watching": one fund has trailed similar funds clearly (e.g. several percentage points since January) or had an unusual drop.
- "Consider reviewing your allocation": several funds are clearly lagging, or the mix looks lopsided.
Put the scheme_code of every fund behind the verdict in watch_scheme_codes (exactly one for
"One fund worth watching", none for "No action needed"). The reason (one or two plain sentences) must
name those funds by their short name, e.g. "SBI Small Cap Fund", and say what they are lagging. Never tell them to buy or sell a specific fund.`;

export async function generateReport(input: ReportInput): Promise<AiReport> {
  const ai = new GoogleGenAI({ apiKey: requireEnv("GEMINI_API_KEY") });
  const model = process.env.GEMINI_MODEL || "gemini-3.6-flash";

  let text: string | undefined;
  try {
    const res = await ai.models.generateContent({
      model,
      contents: [{ role: "user", parts: [{ text: `Here is this week's data as JSON:\n${JSON.stringify(input)}` }] }],
      config: {
        systemInstruction: SYSTEM_PROMPT,
        responseMimeType: "application/json",
        responseSchema,
        temperature: 0.3,
      },
    });
    text = res.text;
  } catch (err) {
    throw new Error(`Gemini request failed: ${err instanceof Error ? err.message : err}`);
  }
  if (!text) throw new Error("Gemini returned an empty response");

  let parsed: AiReport;
  try {
    parsed = JSON.parse(text) as AiReport;
  } catch {
    throw new Error("Gemini returned invalid JSON");
  }
  if (!VERDICTS.includes(parsed.verdict)) parsed.verdict = "No action needed";
  const validCodes = new Set(input.funds.map((f) => f.scheme_code));
  parsed.watch_scheme_codes =
    parsed.verdict === "No action needed"
      ? []
      : (parsed.watch_scheme_codes ?? []).map(Number).filter((c) => validCodes.has(c));

  // Make sure every fund has a summary, even if the model skipped one.
  const byCode = new Map(parsed.funds?.map((f) => [Number(f.scheme_code), f.summary]) ?? []);
  parsed.funds = input.funds.map((f) => ({
    scheme_code: f.scheme_code,
    summary: byCode.get(f.scheme_code) ?? "Summary not available this week.",
  }));
  return parsed;
}
