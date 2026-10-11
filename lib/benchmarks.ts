/**
 * Index-fund NAVs used as stand-ins for the real indices (mfapi has no index data).
 * They track the index closely but include a small expense-ratio drag, so the UI labels them "proxy".
 */
export type Benchmark = { key: string; code: number; name: string };

export const BENCHMARKS = {
  nifty50: { key: "nifty50", code: 120716, name: "Nifty 50" },
  nifty500: { key: "nifty500", code: 147625, name: "Nifty 500" },
  midcap150: { key: "midcap150", code: 147622, name: "Nifty Midcap 150" },
  smallcap100: { key: "smallcap100", code: 153837, name: "Nifty Smallcap 100" },
  smallcap250: { key: "smallcap250", code: 147623, name: "Nifty Smallcap 250" },
  shortGilt: { key: "shortGilt", code: 148792, name: "Short-term govt bonds (CRISIL IBX Gilt 2028)" },
  sp500: { key: "sp500", code: 148381, name: "S&P 500" },
  nasdaq100: { key: "nasdaq100", code: 145552, name: "Nasdaq 100" },
} satisfies Record<string, Benchmark>;

export const ALL_BENCHMARKS: Benchmark[] = Object.values(BENCHMARKS);

/** Pick a benchmark from the AMFI category and fund name. Returns null for cash-like funds. */
export function pickBenchmark(category: string, name: string): Benchmark | null {
  const cat = category.toLowerCase();
  const nm = name.toLowerCase();
  const text = `${cat} ${nm}`;

  if (/liquid|overnight|money market|arbitrage/.test(cat)) return null;
  if (/debt scheme|gilt|duration|bond|credit risk|banking and psu/.test(cat)) return BENCHMARKS.shortGilt;
  if (/nasdaq|technology|tech\b/.test(nm) && /overseas|international|global|us\b|nasdaq/.test(text)) {
    return BENCHMARKS.nasdaq100;
  }
  if (/overseas|international|global|s&p 500|\bus\b|world|emerging/.test(text)) return BENCHMARKS.sp500;
  if (/small\s?cap/.test(text)) return BENCHMARKS.smallcap250;
  if (/large\s?&\s?mid/.test(text)) return BENCHMARKS.nifty500;
  if (/mid\s?cap/.test(text)) return BENCHMARKS.midcap150;
  if (/flexi|multi cap|multicap|nifty 500/.test(text)) return BENCHMARKS.nifty500;
  return BENCHMARKS.nifty50;
}
