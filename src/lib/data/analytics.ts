import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  isOverdue,
  todayDateString,
  OVERDUE_EXCLUDED_STATUSES,
} from "@/lib/tasks/overdue";
import type { TaskWithRelations, TaskStatus } from "./types";

const ACTIVE_STATUSES = [
  "assigned",
  "in_progress",
  "approved",
  "pending_update",
  "pending_review",
  "returned_for_modification",
  "reopened",
];

export type DashboardStats = {
  total: number;
  active: number;
  completed: number;
  completionRate: number;
  overdue: number;
  pendingApprovals: number;
  pendingReview: number;
  avgQuality: number | null;
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
};

export async function getDashboardStats(
  opts: {
    assigneeId?: string;
  } = {},
): Promise<DashboardStats> {
  const supabase = await createClient();
  let q = supabase
    .from("tasks")
    .select("status, priority, due_date, quality_rating");
  if (opts.assigneeId) q = q.eq("assignee_id", opts.assigneeId);
  const { data } = await q;
  const rows = data ?? [];

  const byStatus: Record<string, number> = {};
  const byPriority: Record<string, number> = {};
  for (const r of rows) {
    byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
    byPriority[r.priority] = (byPriority[r.priority] ?? 0) + 1;
  }
  const total = rows.length;
  const completed = byStatus["completed"] ?? 0;
  const ratings = rows
    .map((r) => r.quality_rating)
    .filter((x): x is number => x != null);
  const avgQuality =
    ratings.length > 0
      ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) /
        10
      : null;

  return {
    total,
    active: rows.filter((r) => ACTIVE_STATUSES.includes(r.status)).length,
    completed,
    completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
    // Canonical overdue definition (see @/lib/tasks/overdue): the single source
    // of truth shared with the /tasks overdue filter and the delayed report.
    overdue: rows.filter((r) => isOverdue(r.due_date, r.status as TaskStatus))
      .length,
    pendingApprovals: byStatus["pending_approval"] ?? 0,
    pendingReview: byStatus["pending_review"] ?? 0,
    avgQuality,
    byStatus,
    byPriority,
  };
}

export async function getStatusDistribution(
  opts: {
    assigneeId?: string;
  } = {},
): Promise<{ status: string; count: number }[]> {
  const { byStatus } = await getDashboardStats(opts);
  return Object.entries(byStatus).map(([status, count]) => ({ status, count }));
}

export async function getTasksByBusinessLine(): Promise<
  { label: string; count: number }[]
> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tasks")
    .select("business_line:business_lines!tasks_business_line_id_fkey(name)");
  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    const bl = row.business_line as { name: string } | null;
    const name = bl?.name ?? "Unassigned";
    counts[name] = (counts[name] ?? 0) + 1;
  }
  return Object.entries(counts).map(([label, count]) => ({ label, count }));
}

export async function getCompletionTrend(
  months = 3,
): Promise<{ label: string; completed: number; created: number }[]> {
  const supabase = await createClient();
  const start = new Date();
  start.setUTCMonth(start.getUTCMonth() - (months - 1), 1);
  start.setUTCHours(0, 0, 0, 0);

  const { data } = await supabase
    .from("tasks")
    .select("created_at, completed_at, status")
    .gte("created_at", start.toISOString());

  const buckets: {
    key: string;
    label: string;
    completed: number;
    created: number;
  }[] = [];
  for (let i = 0; i < months; i++) {
    const d = new Date(start);
    d.setUTCMonth(start.getUTCMonth() + i);
    buckets.push({
      key: `${d.getUTCFullYear()}-${d.getUTCMonth()}`,
      label: d.toLocaleString(undefined, { month: "short" }),
      completed: 0,
      created: 0,
    });
  }
  const keyOf = (iso: string) => {
    const d = new Date(iso);
    return `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
  };
  for (const r of data ?? []) {
    if (r.created_at) {
      const b = buckets.find((x) => x.key === keyOf(r.created_at));
      if (b) b.created += 1;
    }
    if (r.completed_at) {
      const b = buckets.find((x) => x.key === keyOf(r.completed_at!));
      if (b) b.completed += 1;
    }
  }
  return buckets.map(({ label, completed, created }) => ({
    label,
    completed,
    created,
  }));
}

const OVERVIEW_SELECT = `
  *,
  assignee:profiles!tasks_assignee_id_fkey(id, full_name),
  creator:profiles!tasks_created_by_fkey(id, full_name),
  approver:profiles!tasks_approved_by_fkey(id, full_name),
  business_line:business_lines!tasks_business_line_id_fkey(id, name)
`;

export async function getOverdueTasks(
  limit = 10,
): Promise<TaskWithRelations[]> {
  const supabase = await createClient();
  // Canonical overdue conditions, mirrored from @/lib/tasks/overdue and the
  // /tasks overdue filter: a non-null past due date and a non-terminal status
  // (terminal = completed/cancelled/rejected). Keeps the dashboard widget, its
  // drill-down, and the delayed report on one definition.
  const { data } = await supabase
    .from("tasks")
    .select(OVERVIEW_SELECT)
    .not("due_date", "is", null)
    .lt("due_date", todayDateString())
    .not("status", "in", `(${OVERDUE_EXCLUDED_STATUSES.join(",")})`)
    .order("due_date", { ascending: true })
    .limit(limit);
  return (data ?? []) as unknown as TaskWithRelations[];
}

export async function getRecentActivity(
  limit = 8,
): Promise<TaskWithRelations[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tasks")
    .select(OVERVIEW_SELECT)
    .order("updated_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as unknown as TaskWithRelations[];
}
