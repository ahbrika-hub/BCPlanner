"use server";

import { z } from "zod";

import { getCurrentProfile, getCurrentPermissions } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import {
  ACTIVE_TASK_STATUSES,
  aggregateEmployeeWorkload,
  type WorkloadAggregate,
} from "@/lib/workload/compute";
import { listHolidayDates } from "@/lib/data/holidays";

const inputSchema = z.object({
  assigneeId: z.uuid(),
  from: z.iso.date(),
  to: z.iso.date(),
  // The task being created has no id yet; kept for symmetry / future edit reuse.
  excludeTaskId: z.uuid().optional(),
});

export type AssigneeWorkload = WorkloadAggregate;

/**
 * Read-only assignee workload for the create-task dialog. Returns ONLY
 * AGGREGATES (counts/hours/capacity/utilisation/level) for the chosen employee
 * over [from, to] — never another employee's task titles/details (privacy).
 *
 * Runs in the CREATOR's session (RLS-scoped read) — never a client-side or
 * privileged query. Gated by tasks.create (the dialog's own gate).
 */
export async function getAssigneeWorkloadAction(
  raw: unknown,
): Promise<AssigneeWorkload | null> {
  const parsed = inputSchema.safeParse(raw);
  if (!parsed.success) return null;
  const { assigneeId, from, to, excludeTaskId } = parsed.data;

  const profile = await getCurrentProfile();
  if (!profile) return null;
  const permissions = await getCurrentPermissions();
  if (!can("tasks.create", permissions)) return null;

  const supabase = await createClient();
  let query = supabase
    .from("tasks")
    .select("id, estimated_effort_hours, start_date, due_date, created_at")
    .eq("assignee_id", assigneeId)
    .in("status", ACTIVE_TASK_STATUSES);
  if (excludeTaskId) query = query.neq("id", excludeTaskId);

  const { data, error } = await query;
  if (error) return null;

  // Keep the action's null-on-failure contract: listHolidayDates throws on a
  // read error, so guard it (a holiday-table hiccup must not reject the preview).
  let holidays: string[];
  try {
    holidays = await listHolidayDates(from, to);
  } catch {
    return null;
  }

  // Map to the aggregation input — drop the id, never surface task identity.
  return aggregateEmployeeWorkload(
    (data ?? []).map((t) => ({
      estimated_effort_hours: t.estimated_effort_hours,
      start_date: t.start_date,
      due_date: t.due_date,
      created_at: t.created_at,
    })),
    from,
    to,
    holidays,
  );
}
