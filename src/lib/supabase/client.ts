import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "@/types/database.types";

/**
 * Creates a Supabase client for use in the browser.
 *
 * Use in Client Components only. A fresh client is returned per call — this is
 * safe and avoids any cross-request shared state.
 *
 * Reads the public env vars (safe to expose to the browser):
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - NEXT_PUBLIC_SUPABASE_ANON_KEY
 *
 * Never throws at module load: env vars are read lazily inside the function.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
