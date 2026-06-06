import { NextResponse, type NextRequest } from "next/server";

import type { Database } from "@/types/database.types";

// Daily recurring-task generation. Secured by CRON_SECRET (Vercel Cron sends it
// as a Bearer token when the env var is set). Uses the server-only service-role
// key because generate_due_recurring_tasks() is granted to service_role, not
// anon. No secret is hardcoded; absent config returns 503.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json(
      { error: "Generation is not configured (missing service-role key)." },
      { status: 503 },
    );
  }

  const { createClient } = await import("@supabase/supabase-js");
  const admin = createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await admin.rpc("generate_due_recurring_tasks");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ created: data ?? 0 });
}
