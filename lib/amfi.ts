import { addDays, fromAmfiDate, todayIST } from "./dates";
import { fetchWithTimeout } from "./http";

const NAV_ALL_URL = "https://portal.amfiindia.com/spages/NAVAll.txt";

type AmfiRow = { code: number; name: string; category: string; date: string };

/**
 * AMFI lists the same category under slightly different headers
 * ("Equity Scheme - ELSS" vs "Equity Schemes - ELSS- Tax Saver Fund"), so compare a normalised key.
 */
export function categoryKey(category: string): string {
  return category
    .toLowerCase()
    .replace(/schemes/g, "scheme")
    // Older debt headers: "Income/Debt Oriented Schemes - Short Term Fund" = "Debt Scheme - Short Duration Fund".
    .replace(/income\/debt oriented scheme/g, "debt scheme")
    .replace(/dynamic term/g, "dynamic bond")
    .replace(/banking and psu debt/g, "banking and psu")
    .replace(/\bterm\b/g, "duration")
    .replace(/tax saver/g, "")
    .replace(/\bfunds?\b/g, "")
    .replace(/[^a-z0-9&]+/g, " ")
    .trim();
}

/** Parse NAVAll.txt into Direct-plan Growth rows tagged with their category header. */
export function parseNavAll(text: string): AmfiRow[] {
  const rows: AmfiRow[] = [];
  let category = "";
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (!line.includes(";")) {
      // Category headers look like "Open Ended Schemes(Equity Scheme - Mid Cap Fund)".
      const m = line.match(/^Open Ended Schemes\s*\((.+)\)\s*$/i);
      if (m) category = m[1].trim();
      else if (/schemes\s*\(/i.test(line)) category = ""; // close-ended / interval: skip
      continue;
    }
    if (!category) continue;
    const parts = line.split(";");
    const code = Number(parts[0]);
    if (!Number.isInteger(code)) continue;
    const lower = line.toLowerCase();
    if (!lower.includes("direct") || !lower.includes("growth")) continue;
    // Skip IDCW/bonus variants ("Dividend Yield" is a fund name, so don't match on "dividend").
    if (/idcw|payout|reinvest|bonus/.test(parts.slice(3, -2).join(" ").toLowerCase())) continue;
    const date = fromAmfiDate(parts[parts.length - 1]);
    if (!date) continue;
    rows.push({ code, name: parts[3]?.trim() ?? "", category, date });
  }
  return rows;
}

/** Up to `count` Direct Growth peers in the same category that published a NAV in the last 10 days. */
export async function pickPeers(category: string, excludeCode: number, count = 10): Promise<number[]> {
  if (!category) return [];
  let text: string;
  try {
    const res = await fetchWithTimeout(NAV_ALL_URL, 45_000);
    text = await res.text();
  } catch (err) {
    console.error("AMFI NAVAll fetch failed", err);
    return [];
  }
  const key = categoryKey(category);
  const cutoff = addDays(todayIST(), -10);
  const seen = new Set<number>();
  return parseNavAll(text)
    .filter((r) => categoryKey(r.category) === key && r.code !== excludeCode && r.date >= cutoff)
    .sort((a, b) => a.code - b.code) // older schemes (lower codes) have longer histories
    .filter((r) => (seen.has(r.code) ? false : (seen.add(r.code), true)))
    .slice(0, count)
    .map((r) => r.code);
}
