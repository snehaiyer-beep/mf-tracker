export function Pct({ value }: { value: number | null | undefined }) {
  if (value === null || value === undefined) return <span className="text-slate-400">—</span>;
  const n = Number(value);
  return (
    <span className={n >= 0 ? "text-green-700" : "text-red-700"}>
      {n >= 0 ? "+" : ""}
      {n.toFixed(2)}%
    </span>
  );
}

export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    // non-JSON response
  }
  if (!res.ok) {
    const msg = (json as { error?: string } | null)?.error ?? `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return json as T;
}
