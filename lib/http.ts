/** fetch with a timeout and no Next.js caching. Throws on non-2xx. */
export async function fetchWithTimeout(url: string, timeoutMs = 20_000, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, cache: "no-store", signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} from ${new URL(url).host}`);
    return res;
  } finally {
    clearTimeout(timer);
  }
}

/** Run async tasks with limited concurrency; never rejects, returns settled results. */
export async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      try {
        results[i] = { status: "fulfilled", value: await fn(items[i]) };
      } catch (reason) {
        results[i] = { status: "rejected", reason };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
