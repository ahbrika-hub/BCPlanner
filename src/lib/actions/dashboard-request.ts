"use server";

import { revalidatePath } from "next/cache";

import { getCurrentProfile, getCurrentPermissions } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/actions/tasks";

/**
 * "Request update" — admin/section_head/ceo (anyone holding
 * dashboard.request_update) initiates a directly-assigned, actionable
 * "Dashboard Update" task via the SECURITY DEFINER request_dashboard_update()
 * function, which de-dups, resolves the assignee, and notifies assignee +
 * section_heads + admins. No tasks.create grant, no broadened tasks RLS.
 *
 * Returns `{ ok:false, error:"no_assignee" }` (a sentinel) when no dashboard
 * owner is configured and no assignee was supplied — the UI then prompts for one.
 */
export async function requestDashboardUpdateAction(
  assigneeId?: string,
): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Not authenticated." };
  const permissions = await getCurrentPermissions();
  if (!can("dashboard.request_update", permissions)) {
    return { ok: false, error: "Not authorized." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "request_dashboard_update",
    assigneeId ? { p_assignee: assigneeId } : {},
  );
  if (error) return { ok: false, error: error.message };

  const result = (data ?? {}) as {
    created?: boolean;
    reason?: string;
    taskId?: string;
  };
  if (result.created) {
    revalidatePath("/dashboard/weekly");
    revalidatePath("/dashboard");
    revalidatePath("/tasks");
    return { ok: true, id: result.taskId };
  }
  if (result.reason === "in_progress") {
    return { ok: false, error: "A dashboard update is already in progress." };
  }
  if (result.reason === "no_assignee") {
    return { ok: false, error: "no_assignee" };
  }
  return { ok: false, error: "Could not create the request." };
}
