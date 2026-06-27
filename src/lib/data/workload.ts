import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  ACTIVE_TASK_STATUSES,
  aggregateEmployeeWorkload,
  type WorkloadTaskInput,
} from "@/lib/workload/compute";
import { listHolidayDates } from "@/lib/data/holidays";
import type { WorkloadRow } from "./types";

/**
 * Current active workload from the daily_employee_workload view (single-day
 * capacity). Unchanged — still used by the operational dashboard widget.
 */
export async function getWorkload(
  filters: { search?: string } = {},
): Promise<WorkloadRow[]> {
  const supabase = await createClient();
  let query = supabase
    .from("daily_employee_workload")
    .select("*")
    .order("active_task_count", { ascending: false });

  if (filters.search) {
    query = query.ilike("full_name", `%${filters.search}%`);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as WorkloadRow[];
}

/** A task that can be drag-reassigned (status where the 'assign' action is legal). */
export type ReassignableTask = {
  id: string;
  task_no: string | null;
  title: string;
  status: string;
  assignee_id: string | null;
  /** Current assignee's name (so the board can still render a column for an
   *  assignee who isn't in the active-profile set, e.g. a deactivated user). */
  assignee_name: string | null;
};

/**
 * Statuses from which the EXISTING 'assign' transition is legal (approved/reopened
 * → assigned) or a no-op assignee change (assigned → assigned). Dragging a task
 * in any other status would be rejected by the transition guard, so only these
 * are offered as drag sources. RLS-scoped (managers with tasks.read_all see all).
 */
export const REASSIGNABLE_STATUSES = ["approved", "reopened", "assigned"] as const;

export async function getReassignableTasks(): Promise<ReassignableTask[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .select(
      "id, task_no, title, status, assignee_id, assignee:profiles!tasks_assignee_id_fkey(full_name)",
    )
    .in("status", [...REASSIGNABLE_STATUSES])
    .order("task_no", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((t) => {
    const assignee = t.assignee as { full_name: string | null } | null;
    return {
      id: t.id,
      task_no: t.task_no,
      title: t.title,
      status: t.status,
      assignee_id: t.assignee_id,
      assignee_name: assignee?.full_name ?? null,
    };
  });
}

/**
 * Per-employee active workload aggregated over the inclusive range [from, to]
 * (the Workload page's period filter). Recomputed in app code over the SAME
 * RLS-scoped reads the security_invoker view uses: profiles (employee → self;
 * managers with users.read → all) and tasks (employee → own/assigned; managers
 * with tasks.read_all → all). No scoping change.
 */
export async function getWorkloadForRange(filters: {
  from: string;
  to: string;
  search?: string;
}): Promise<WorkloadRow[]> {
  const supabase = await createClient();

  let profileQuery = supabase
    .from("profiles")
    .select("id, full_name, department_id")
    .eq("is_active", true)
    .order("full_name", { ascending: true });
  if (filters.search) {
    profileQuery = profileQuery.ilike("full_name", `%${filters.search}%`);
  }

  const [profilesRes, tasksRes, holidays] = await Promise.all([
    profileQuery,
    supabase
      .from("tasks")
      .select(
        "assignee_id, estimated_effort_hours, start_date, due_date, created_at",
      )
      .in("status", ACTIVE_TASK_STATUSES)
      .not("assignee_id", "is", null),
    // Public holidays in range — subtracted from capacity by the central helper.
    listHolidayDates(filters.from, filters.to),
  ]);
  if (profilesRes.error) throw new Error(profilesRes.error.message);
  if (tasksRes.error) throw new Error(tasksRes.error.message);

  const byAssignee = new Map<string, WorkloadTaskInput[]>();
  for (const t of tasksRes.data ?? []) {
    if (!t.assignee_id) continue;
    const list = byAssignee.get(t.assignee_id) ?? [];
    list.push(t);
    byAssignee.set(t.assignee_id, list);
  }

  return (profilesRes.data ?? [])
    .map((p): WorkloadRow => {
      const agg = aggregateEmployeeWorkload(
        byAssignee.get(p.id) ?? [],
        filters.from,
        filters.to,
        holidays,
      );
      return {
        employee_id: p.id,
        full_name: p.full_name,
        department_id: p.department_id,
        active_task_count: agg.active_task_count,
        total_estimated_hours: agg.total_estimated_hours,
        utilization_pct: agg.utilization_pct,
        workload_level: agg.workload_level,
      };
    })
    // Hours-vs-capacity is the primary signal now, so rank the most
    // over-capacity employees first; fall back to hours, then count.
    .sort(
      (a, b) =>
        (b.utilization_pct ?? 0) - (a.utilization_pct ?? 0) ||
        (b.total_estimated_hours ?? 0) - (a.total_estimated_hours ?? 0) ||
        (b.active_task_count ?? 0) - (a.active_task_count ?? 0),
    );
}
