/**
 * Two separate jobs, as in the brief:
 *  1. Market context: how Nifty 50, Nifty Midcap 150 and Nifty Smallcap 100 moved this week.
 *  2. Per-fund comparison against the fund's stated benchmark index.
 *
 * mfapi has no index data, so every index is read from an index fund/ETF that tracks it (or the
 * closest one that exists). The UI labels these "stand-in" so it is clear they are proxies.
 */
export type Benchmark = { key: string; code: number; name: string };

export const PROXIES = {
  nifty50: { key: "nifty50", code: 120716, name: "Nifty 50" }, // UTI Nifty 50 Index Fund
  nifty100: { key: "nifty100", code: 147666, name: "Nifty 100" }, // Axis Nifty 100 Index Fund
  nifty500: { key: "nifty500", code: 147625, name: "Nifty 500" }, // Motilal Oswal Nifty 500 Index Fund
  largeMid250: { key: "largeMid250", code: 152482, name: "Nifty LargeMidcap 250" }, // ICICI Pru Nifty LargeMidcap 250 Index Fund
  midcap150: { key: "midcap150", code: 147622, name: "Nifty Midcap 150" }, // Motilal Oswal Nifty Midcap 150 Index Fund
  smallcap100: { key: "smallcap100", code: 153837, name: "Nifty Smallcap 100" }, // Zerodha Nifty Smallcap 100 ETF
  smallcap250: { key: "smallcap250", code: 147623, name: "Nifty Smallcap 250" }, // Motilal Oswal Nifty Smallcap 250 Index Fund
  shortGilt: { key: "shortGilt", code: 148792, name: "Short-term govt bonds" }, // Bandhan CRISIL IBX Gilt Apr 2028 Index Fund
  nasdaq100: { key: "nasdaq100", code: 145552, name: "Nasdaq 100" }, // Motilal Oswal Nasdaq 100 FoF
  sp500: { key: "sp500", code: 148381, name: "S&P 500" }, // Motilal Oswal S&P 500 Index Fund
} satisfies Record<string, Benchmark>;

/** The three indices the weekly market context reports on (from the brief). */
export const MARKET_INDICES: Benchmark[] = [PROXIES.nifty50, PROXIES.midcap150, PROXIES.smallcap100];

export type BenchmarkPick = {
  /** The index the fund measures itself against, as named for its category (AMFI tier-1 style). */
  stated: string;
  /** Index fund used to get that index's numbers; null when nothing public tracks it closely. */
  proxy: Benchmark | null;
};

/** Pick the stated benchmark for a fund from its AMFI category and name, plus the closest stand-in. */
export function pickBenchmark(category: string, name: string): BenchmarkPick {
  const cat = category.toLowerCase();
  const nm = name.toLowerCase();
  const text = `${cat} ${nm}`;

  // Index funds state the index they copy.
  if (/index fund|etf/.test(cat) || /\bindex\b|\betf\b/.test(nm)) {
    if (/nifty 50\b/.test(nm) && !/next/.test(nm)) return { stated: "NIFTY 50 TRI", proxy: PROXIES.nifty50 };
    if (/nifty 100\b/.test(nm)) return { stated: "NIFTY 100 TRI", proxy: PROXIES.nifty100 };
    if (/midcap 150/.test(nm)) return { stated: "NIFTY Midcap 150 TRI", proxy: PROXIES.midcap150 };
    if (/smallcap 250/.test(nm)) return { stated: "NIFTY Smallcap 250 TRI", proxy: PROXIES.smallcap250 };
    if (/smallcap 100/.test(nm)) return { stated: "NIFTY Smallcap 100 TRI", proxy: PROXIES.smallcap100 };
    if (/nifty 500\b/.test(nm)) return { stated: "NIFTY 500 TRI", proxy: PROXIES.nifty500 };
    if (/nasdaq/.test(nm)) return { stated: "NASDAQ-100 TRI", proxy: PROXIES.nasdaq100 };
    if (/s&p 500/.test(nm)) return { stated: "S&P 500 TRI", proxy: PROXIES.sp500 };
  }

  // Overseas funds of funds follow the market they invest in.
  if (/overseas|international|global|nasdaq|s&p|\bus\b|world|emerging/.test(text)) {
    if (/nasdaq|tech/.test(nm)) return { stated: "US technology stocks", proxy: PROXIES.nasdaq100 };
    return { stated: "US large companies (S&P 500)", proxy: PROXIES.sp500 };
  }

  // Debt and cash-like funds.
  if (/liquid|overnight|money market|arbitrage/.test(cat)) return { stated: "Short-term money market rates", proxy: null };
  if (/short duration|short term|low duration|ultra short/.test(text) && /debt|duration|term/.test(cat)) {
    return { stated: "CRISIL Short Duration Debt A-II Index", proxy: PROXIES.shortGilt };
  }
  if (/debt|gilt|bond|duration|credit risk|banking and psu/.test(cat)) return { stated: "CRISIL debt index for this category", proxy: PROXIES.shortGilt };

  // Equity categories (SEBI/AMFI tier-1 benchmarks).
  if (/small\s?cap/.test(text)) return { stated: "NIFTY Smallcap 250 TRI", proxy: PROXIES.smallcap250 };
  if (/large\s?&\s?mid/.test(text)) return { stated: "NIFTY LargeMidcap 250 TRI", proxy: PROXIES.largeMid250 };
  if (/mid\s?cap/.test(text)) return { stated: "NIFTY Midcap 150 TRI", proxy: PROXIES.midcap150 };
  if (/large\s?cap/.test(text)) return { stated: "NIFTY 100 TRI", proxy: PROXIES.nifty100 };
  if (/flexi|multi cap|elss|focused|value|contra|dividend/.test(text)) return { stated: "NIFTY 500 TRI", proxy: PROXIES.nifty500 };
  return { stated: "NIFTY 50 TRI", proxy: PROXIES.nifty50 };
}
