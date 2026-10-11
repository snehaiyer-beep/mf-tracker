import { XMLParser } from "fast-xml-parser";
import { addDays, todayIST } from "./dates";
import { errorMessage, fetchWithTimeout } from "./http";
import { db } from "./supabase";

export type NewsItem = {
  link: string;
  title: string;
  description: string | null;
  source: string | null;
  published_at: string | null;
};

const QUERY = 'nifty OR sensex OR RBI OR "stock market"';

type NewsDataArticle = {
  title?: string;
  link?: string;
  description?: string | null;
  source_name?: string;
  source_id?: string;
  pubDate?: string;
};

type NewsDataResponse = {
  status?: string;
  // On error NewsData returns { status: "error", results: { message, code } }.
  results?: NewsDataArticle[] | { message?: string; code?: string };
};

/** NewsData.io returns pubDate as "YYYY-MM-DD HH:mm:ss" in UTC. */
function newsDataDate(d?: string): string | null {
  if (!d) return null;
  const parsed = new Date(d.replace(" ", "T") + "Z");
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

async function fetchNewsData(): Promise<NewsItem[]> {
  const key = process.env.NEWSDATA_API_KEY;
  if (!key) throw new Error("NEWSDATA_API_KEY not set");
  const url =
    `https://newsdata.io/api/1/latest?apikey=${encodeURIComponent(key)}` +
    `&country=in&category=business&language=en&q=${encodeURIComponent(QUERY)}`;
  const res = await fetchWithTimeout(url, 20_000);
  const json = (await res.json()) as NewsDataResponse;
  if (json.status !== "success" || !Array.isArray(json.results)) {
    const detail = json.results && !Array.isArray(json.results) ? json.results.message : undefined;
    throw new Error(`NewsData error: ${detail ?? json.status ?? "unknown"}`);
  }
  return json.results
    .filter((r) => r.link && r.title)
    .map((r) => ({
      link: r.link!,
      title: r.title!.trim(),
      description: r.description?.trim() || null,
      source: r.source_name ?? r.source_id ?? null,
      published_at: newsDataDate(r.pubDate),
    }));
}

type RssItem = {
  title?: string;
  link?: string;
  pubDate?: string;
  source?: string | { "#text"?: string };
};

async function fetchGoogleNews(): Promise<NewsItem[]> {
  const q = encodeURIComponent(`${QUERY} when:2d`);
  const url = `https://news.google.com/rss/search?q=${q}&hl=en-IN&gl=IN&ceid=IN:en`;
  const res = await fetchWithTimeout(url, 20_000);
  const parsed = new XMLParser({ ignoreAttributes: false }).parse(await res.text());
  const raw = parsed?.rss?.channel?.item;
  const items: RssItem[] = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return items
    .filter((i) => i.link && i.title)
    .slice(0, 40)
    .map((i) => {
      const date = i.pubDate ? new Date(i.pubDate) : null;
      return {
        link: i.link!,
        title: String(i.title).trim(),
        description: null, // Google's RSS description is only HTML links
        source: typeof i.source === "string" ? i.source : (i.source?.["#text"] ?? null),
        published_at: date && !Number.isNaN(date.getTime()) ? date.toISOString() : null,
      };
    });
}

/** Fetch today's market news (NewsData, falling back to Google News RSS) and store it. */
export async function refreshNews(): Promise<{ source: string; stored: number; error?: string }> {
  let items: NewsItem[] = [];
  let source = "newsdata";
  let firstError: string | undefined;
  try {
    items = await fetchNewsData();
  } catch (err) {
    firstError = errorMessage(err);
    console.error("NewsData failed, falling back to Google News", err);
  }
  if (items.length === 0) {
    source = "google-news";
    try {
      items = await fetchGoogleNews();
    } catch (err) {
      return { source, stored: 0, error: [firstError, errorMessage(err)].filter(Boolean).join("; ") };
    }
  }
  if (items.length === 0) return { source, stored: 0, error: firstError };

  const { error } = await db()
    .from("market_news")
    .upsert(items, { onConflict: "link", ignoreDuplicates: true });
  if (error) return { source, stored: 0, error: `Supabase: ${error.message}` };
  return { source, stored: items.length, error: firstError };
}

export async function recentNews(days = 7, limit = 40): Promise<NewsItem[]> {
  const since = addDays(todayIST(), -days);
  const { data, error } = await db()
    .from("market_news")
    .select("link, title, description, source, published_at")
    .gte("published_at", since)
    .order("published_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("Loading news failed", error);
    return [];
  }
  return (data ?? []) as NewsItem[];
}
