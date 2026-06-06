import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import type { Database } from "@/types/database.types";

/**
 * Refreshes the Supabase auth session on every matched request.
 *
 * Called from the root `src/middleware.ts`. It reads cookies from the incoming
 * request, writes refreshed auth cookies onto the outgoing response, and
 * returns that response so the caller can forward it.
 *
 * No route protection is performed here (that arrives in P5) — this only keeps
 * the session fresh.
 */
export async function updateSession(
  request: NextRequest,
): Promise<NextResponse> {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANT: Do not remove this call. Refreshing the auth token here keeps
  // Server Components, Server Actions, and Route Handlers in sync. Do not run
  // any logic between client creation and this call.
  //
  // Guard against transient auth/network failures: a rejected refresh must not
  // take down the whole request. On error we still return the response so the
  // request can proceed (downstream code re-resolves auth state as needed).
  try {
    await supabase.auth.getUser();
  } catch (error) {
    console.error("Supabase session refresh failed in middleware:", error);
  }

  return supabaseResponse;
}
