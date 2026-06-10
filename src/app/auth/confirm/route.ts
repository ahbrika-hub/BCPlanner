import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";

/**
 * Email-link confirmation endpoint (used by the password-reset flow). Verifies
 * the one-time token server-side via verifyOtp — which establishes the session
 * cookie — then forwards to the validated `next` path. On any failure it sends
 * the user to /login with a neutral error.
 *
 * `next` must be a same-origin RELATIVE path (starts with a single "/") to
 * prevent open-redirects; otherwise it falls back to /update-password.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const rawNext = searchParams.get("next");
  const safeNext =
    rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//")
      ? rawNext
      : "/update-password";

  if (!tokenHash || !type) {
    return NextResponse.redirect(new URL("/login?error=link_invalid", request.url));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });

  if (error) {
    return NextResponse.redirect(new URL("/login?error=link_invalid", request.url));
  }

  return NextResponse.redirect(new URL(safeNext, request.url));
}
