import { type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";

/**
 * Root Next.js middleware.
 *
 * Currently performs Supabase session refresh only. Route protection is added
 * in P5.
 */
export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - static image assets (svg, png, jpg, jpeg, gif, webp, ico)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
