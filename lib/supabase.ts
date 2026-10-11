import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { requireEnv } from "./env";

let client: SupabaseClient | null = null;

/** Server-only client using the service-role key. Never import this from a client component. */
export function db(): SupabaseClient {
  if (!client) {
    client = createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
      auth: { persistSession: false },
    });
  }
  return client;
}

export type Fund = {
  scheme_code: number;
  name: string;
  category: string | null;
  benchmark_code: number | null;
  benchmark_name: string | null;
  peer_codes: number[];
  is_active: boolean;
};

export type Snapshot = {
  week_ending: string;
  scheme_code: number;
  wow: number | null;
  mom: number | null;
  ytd: number | null;
  bench_wow: number | null;
  bench_mom: number | null;
  bench_ytd: number | null;
  cat_wow: number | null;
  cat_mom: number | null;
  cat_ytd: number | null;
};
