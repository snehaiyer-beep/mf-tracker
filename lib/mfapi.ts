import { fromMfapiDate } from "./dates";
import { fetchWithTimeout } from "./http";

export type NavPoint = { date: string; nav: number };

export type SchemeData = {
  code: number;
  name: string;
  category: string;
  fundHouse: string;
  navs: NavPoint[]; // ascending by date
};

type MfapiResponse = {
  meta?: { scheme_code?: number; scheme_name?: string; scheme_category?: string; fund_house?: string };
  data?: { date: string; nav: string }[];
  status?: string;
};

/** Full NAV history for a scheme. Throws if the code is unknown or the API fails. */
export async function fetchScheme(code: number): Promise<SchemeData> {
  let json: MfapiResponse;
  try {
    const res = await fetchWithTimeout(`https://api.mfapi.in/mf/${code}`, 25_000);
    json = (await res.json()) as MfapiResponse;
  } catch (err) {
    throw new Error(`mfapi request for ${code} failed: ${err instanceof Error ? err.message : err}`);
  }
  if (!json.meta?.scheme_name || !Array.isArray(json.data) || json.data.length === 0) {
    throw new Error(`Scheme code ${code} not found on mfapi`);
  }
  const navs = json.data
    .map((d) => ({ date: fromMfapiDate(d.date), nav: Number(d.nav) }))
    .filter((d) => Number.isFinite(d.nav) && d.nav > 0)
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  return {
    code,
    name: json.meta.scheme_name,
    category: json.meta.scheme_category ?? "",
    fundHouse: json.meta.fund_house ?? "",
    navs,
  };
}

export type SearchResult = { schemeCode: number; schemeName: string };

export async function searchSchemes(q: string): Promise<SearchResult[]> {
  try {
    const res = await fetchWithTimeout(`https://api.mfapi.in/mf/search?q=${encodeURIComponent(q)}`, 15_000);
    const json = (await res.json()) as SearchResult[];
    return Array.isArray(json) ? json : [];
  } catch (err) {
    throw new Error(`mfapi search failed: ${err instanceof Error ? err.message : err}`);
  }
}
