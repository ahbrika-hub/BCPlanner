import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { TaskWithRelations, TaskStatus } from "./types";

const REPORT_SELECT = `
  *,
  assignee:profiles!tasks_assignee_id_fkey(id, full_name),
  creator:profiles!tasks_created_by_fkey(id, full_name),
  approver:profiles!tasks_approved_by_fkey(id, full_name),
  business_line:business_lines!tasks_business_line_id_fkey(id, name)
`;

export type ReportFilters = {
  from?: string;
  to?: string;
  business_line_id?: string;
  assignee_id?: string;
  status?: TaskStatus;
};

export type ReportSummary = {
  count: number;
  completed: number;
  delayed: number;
  avgQuality: number | null;
};

export async function getReportData(filters: ReportFilters): Promise<{
  tasks: TaskWithRelations[];
  summary: ReportSummary;
}> {
  const supabase = await createClient();
  let q = supabase
    .from("tasks")
    .select(REPORT_SELECT)
    .order("created_at", { ascending: false });

  if (filters.from) q = q.gte("created_at", filters.from);
  if (filters.to) q = q.lte("created_at", `${filters.to}T23:59:59`);
  if (filters.business_line_id)
    q = q.eq("business_line_id", filters.business_line_id);
  if (filters.assignee_id) q = q.eq("assignee_id", filters.assignee_id);
  if (filters.status) q = q.eq("status", filters.status);

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const tasks = (data ?? []) as unknown as TaskWithRelations[];

  const completedRows = tasks.filter((t) => t.status === "completed");
  const delayed = completedRows.filter(
    (t) =>
      t.due_date &&
      t.completed_at &&
      new Date(t.completed_at) > new Date(t.due_date),
  ).length;
  const ratings = completedRows
    .map((t) => t.quality_rating)
    .filter((x): x is number => x != null);
  const avgQuality =
    ratings.length > 0
      ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) /
        10
      : null;

  return {
    tasks,
    summary: {
      count: tasks.length,
      completed: completedRows.length,
      delayed,
      avgQuality,
    },
  };
}
