import "server-only";

import { emailEnabled, sendEmail } from "./send";
import type { Database } from "@/types/database.types";

type UserRole = Database["public"]["Enums"]["user_role"];
type EmailRow = { email: string | null };

// The 4 confirmed email events.
export type EmailEvent =
  | "task_assigned"
  | "pending_approval"
  | "pending_review"
  | "completed";

const SUBJECTS: Record<EmailEvent, string> = {
  task_assigned: "A task has been assigned to you",
  pending_approval: "A task is awaiting your approval",
  pending_review: "A task is awaiting your review",
  completed: "A task has been completed",
};

function html(event: EmailEvent, taskRef: string): string {
  return `<div style="font-family:sans-serif">
    <h2 style="color:#762651">TSS Planner</h2>
    <p>${SUBJECTS[event]}:</p>
    <p><strong>${taskRef}</strong></p>
    <p>Open TSS Planner to view the task.</p>
  </div>`;
}

/** A service-role client to resolve recipient emails without loosening RLS. */
async function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  const { createClient } = await import("@supabase/supabase-js");
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function emailsForIds(ids: (string | null)[]): Promise<string[]> {
  const admin = await adminClient();
  if (!admin) return [];
  const unique = [...new Set(ids.filter((x): x is string => !!x))];
  if (unique.length === 0) return [];
  const { data } = await admin
    .from("profiles")
    .select("email")
    .in("id", unique);
  return (data ?? [])
    .map((r: EmailRow) => r.email)
    .filter((e): e is string => !!e);
}

async function emailsForRole(role: UserRole): Promise<string[]> {
  const admin = await adminClient();
  if (!admin) return [];
  const { data } = await admin
    .from("profiles")
    .select("email")
    .eq("role", role)
    .eq("is_active", true);
  return (data ?? [])
    .map((r: EmailRow) => r.email)
    .filter((e): e is string => !!e);
}

/** Email specific users for an event (no-op unless email is fully configured). */
export async function emailUsers(
  event: EmailEvent,
  userIds: (string | null)[],
  taskRef: string,
): Promise<void> {
  if (!emailEnabled()) return;
  const to = await emailsForIds(userIds);
  for (const addr of to) {
    await sendEmail({
      to: addr,
      subject: SUBJECTS[event],
      html: html(event, taskRef),
    });
  }
}

/** Email every active user of a role for an event. */
export async function emailRole(
  event: EmailEvent,
  role: UserRole,
  taskRef: string,
): Promise<void> {
  if (!emailEnabled()) return;
  const to = await emailsForRole(role);
  for (const addr of to) {
    await sendEmail({
      to: addr,
      subject: SUBJECTS[event],
      html: html(event, taskRef),
    });
  }
}
