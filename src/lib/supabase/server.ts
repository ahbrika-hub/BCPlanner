import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import type { Database } from "@/types/database.types";

/**
 * Creates a Supabase client for server-side use.
 *
 * Use in Server Components, Server Actions, and Route Handlers only.
 *
 * SUPABASE_SERVICE_ROLE_KEY must NEVER be used here — this client uses the
 * anon key and operates under Row Level Security (RLS).
 *
 * In Next.js 16 (App Router) `cookies()` is async and must be awaited.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // `setAll` was called from a Server Component. This can be safely
            // ignored when middleware is refreshing user sessions.
          }
        },
      },
    },
  );
}
