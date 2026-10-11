/**
 * The three indices the weekly report tracks. mfapi has no index data, so each uses an
 * index fund/ETF NAV as a stand-in (small expense-ratio drag), labelled "proxy" in the UI.
 */
export type Benchmark = { key: string; code: number; name: string };

export const BENCHMARKS = {
  nifty50: { key: "nifty50", code: 120716, name: "Nifty 50" }, // UTI Nifty 50 Index Fund
  midcap150: { key: "midcap150", code: 147622, name: "Nifty Midcap 150" }, // Motilal Oswal Nifty Midcap 150 Index Fund
  smallcap100: { key: "smallcap100", code: 153837, name: "Nifty Smallcap 100" }, // Zerodha Nifty Smallcap 100 ETF
} satisfies Record<string, Benchmark>;

export const ALL_BENCHMARKS: Benchmark[] = Object.values(BENCHMARKS);

/**
 * Match an Indian equity fund to one of the three indices. Debt, hybrid-debt and overseas
 * funds have no matching index and are compared with their similar-funds average only.
 */
export function pickBenchmark(category: string, name: string): Benchmark | null {
  const cat = category.toLowerCase();
  const text = `${cat} ${name.toLowerCase()}`;

  if (/debt|liquid|overnight|money market|arbitrage|gilt|bond|duration|credit risk|conservative|savings/.test(cat)) return null;
  if (/overseas|international|global|nasdaq|s&p|\bus\b|world|emerging|gold|silver/.test(text)) return null;
  if (/small\s?cap/.test(text)) return BENCHMARKS.smallcap100;
  if (/mid\s?cap/.test(text) && !/large\s?&\s?mid/.test(text)) return BENCHMARKS.midcap150;
  return BENCHMARKS.nifty50;
}
