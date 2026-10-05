import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";
import { normalizeSupabaseUrl } from "./url";

export function createClient() {
  const url = normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";

  return createBrowserClient<Database>(url, anonKey);
}
