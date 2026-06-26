import { NextResponse, type NextRequest } from "next/server";

import type { Database } from "@/types/database.types";
import { sendEmail, emailEnabled } from "@/lib/email/send";
import {
  buildDigests,
  renderDigestEmail,
  type OverdueTask,
  type RecipientProfile,
} from "@/lib/notifications/digest";

// Daily overdue-escalation digest. Mirrors generate-recurring: secured by
// CRON_SECRET (Bearer; 401 if missing/wrong) and the server-only service-role
// key (503 if unset). It computes one batched digest per recipient using the
// canonical overdue rule (overdue_tasks SQL fn) and sends via the EXISTING email
// layer — so it is automatically a NO-OP when EMAIL_ENABLED/Resend are not set.
// Designed to be called once daily. Does NOT create per-task notifications and
// does NOT touch the task lifecycle.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json(
      { error: "Digest is not configured (missing service-role key)." },
      { status: 503 },
    );
  }

  const { createClient } = await import("@supabase/supabase-js");
  const admin = createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // All overdue tasks (canonical rule lives in the SQL fn; service-role only).
  const { data: overdueData, error: overdueErr } =
    await admin.rpc("overdue_tasks");
  if (overdueErr) {
    return NextResponse.json({ error: overdueErr.message }, { status: 500 });
  }
  const overdue = (overdueData ?? []) as OverdueTask[];

  // Manager (oversight) recipients: active section_head/admin. No manager→report
  // mapping exists and they hold tasks.read_all (org-wide), so the oversight
  // scope is org-wide — see the report.
  const { data: managers } = await admin
    .from("profiles")
    .select("id, email, full_name")
    .in("role", ["section_head", "admin"])
    .eq("is_active", true);
  const managerIds = (managers ?? []).map((m) => m.id);

  // Resolve emails for assignees-with-overdue ∪ managers (service-role lookup of
  // profiles.email — RLS is not loosened).
  const assigneeIds = [
    ...new Set(
      overdue.map((t) => t.assignee_id).filter((x): x is string => !!x),
    ),
  ];
  const recipientIds = [...new Set([...assigneeIds, ...managerIds])];

  const profilesById: Record<string, RecipientProfile> = {};
  if (recipientIds.length > 0) {
    const { data: profs } = await admin
      .from("profiles")
      .select("id, email, full_name")
      .in("id", recipientIds);
    for (const p of profs ?? []) profilesById[p.id] = p;
  }

  const digests = buildDigests({ overdue, managerIds, profilesById });

  // Send one email per recipient. sendEmail is a no-op unless EMAIL_ENABLED +
  // Resend + EMAIL_FROM are set, so with the flag off this loop sends nothing
  // while still having computed the correct recipient set above.
  const enabled = emailEnabled();
  for (const digest of digests) {
    const { subject, html } = renderDigestEmail(digest);
    await sendEmail({ to: digest.email, subject, html });
  }

  return NextResponse.json({
    ok: true,
    emailEnabled: enabled,
    overdueTasks: overdue.length,
    recipients: digests.length,
    sent: enabled ? digests.length : 0,
  });
}
