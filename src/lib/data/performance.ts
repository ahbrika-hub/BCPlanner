import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  calculatePerformanceScore,
  type PerformanceMetrics,
} from "@/lib/performance/score";
import type { Tables } from "./types";

export { calculatePerformanceScore };
export type { PerformanceMetrics };

export type EvaluationWithEmployee =
  Tables["performance_evaluations"]["Row"] & {
    employee: { id: string; full_name: string } | null;
  };

export type ComputedMetrics = {
  assigned_tasks_count: number;
  completed_tasks_count: number;
  delayed_tasks_count: number;
  returned_tasks_count: number;
  avg_completion_days: number | null;
  quality_avg_rating: number | null;
  workload_level: string | null;
  overall_score: number;
};

/** Parse a 'YYYY-Qn' period into a UTC [from, to) range, or null for all-time. */
export function periodRange(
  period: string,
): { from: string; to: string } | null {
  const m = /^(\d{4})-Q([1-4])$/.exec(period);
  if (!m) return null;
  const year = Number(m[1]);
  const startMonth = (Number(m[2]) - 1) * 3;
  return {
    from: new Date(Date.UTC(year, startMonth, 1)).toISOString(),
    to: new Date(Date.UTC(year, startMonth + 3, 1)).toISOString(),
  };
}

export async function computeEmployeeMetrics(
  employeeId: string,
  period: string,
): Promise<ComputedMetrics> {
  const supabase = await createClient();
  const range = periodRange(period);

  let q = supabase
    .from("tasks")
    .select("status, quality_rating, due_date, completed_at, created_at")
    .eq("assignee_id", employeeId);
  if (range) q = q.gte("created_at", range.from).lt("created_at", range.to);

  const { data } = await q;
  const rows = data ?? [];
  const now = Date.now();

  const completedRows = rows.filter((r) => r.status === "completed");
  const assigned = rows.length;
  const completed = completedRows.length;
  const delayed = rows.filter((r) => {
    if (r.status === "completed") {
      return r.due_date && r.completed_at
        ? new Date(r.completed_at) > new Date(r.due_date)
        : false;
    }
    return r.due_date ? new Date(r.due_date).getTime() < now : false;
  }).length;
  const returned = rows.filter(
    (r) => r.status === "returned_for_modification",
  ).length;

  const ratings = completedRows
    .map((r) => r.quality_rating)
    .filter((x): x is number => x != null);
  const quality_avg =
    ratings.length > 0
      ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) /
        10
      : null;

  const days = completedRows
    .map((r) =>
      r.completed_at && r.created_at
        ? (new Date(r.completed_at).getTime() -
            new Date(r.created_at).getTime()) /
          86_400_000
        : null,
    )
    .filter((x): x is number => x != null);
  const avg_completion_days =
    days.length > 0
      ? Math.round((days.reduce((a, b) => a + b, 0) / days.length) * 10) / 10
      : null;

  const { data: wl } = await supabase
    .from("daily_employee_workload")
    .select("workload_level")
    .eq("employee_id", employeeId)
    .maybeSingle();

  const overall = calculatePerformanceScore({
    assigned_count: assigned,
    completed_count: completed,
    delayed_count: delayed,
    quality_avg_rating: quality_avg,
  });

  return {
    assigned_tasks_count: assigned,
    completed_tasks_count: completed,
    delayed_tasks_count: delayed,
    returned_tasks_count: returned,
    avg_completion_days,
    quality_avg_rating: quality_avg,
    workload_level: wl?.workload_level ?? null,
    overall_score: overall,
  };
}

export async function listEvaluations(
  employeeId?: string,
): Promise<EvaluationWithEmployee[]> {
  const supabase = await createClient();
  let q = supabase
    .from("performance_evaluations")
    .select(
      "*, employee:profiles!performance_evaluations_employee_id_fkey(id, full_name)",
    )
    .order("created_at", { ascending: false });
  if (employeeId) q = q.eq("employee_id", employeeId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as EvaluationWithEmployee[];
}

export async function getEvaluation(
  id: string,
): Promise<EvaluationWithEmployee | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("performance_evaluations")
    .select(
      "*, employee:profiles!performance_evaluations_employee_id_fkey(id, full_name)",
    )
    .eq("id", id)
    .maybeSingle();
  return (data as unknown as EvaluationWithEmployee) ?? null;
}

/**
 * The existing evaluation for an employee+period, if any (earliest row, so
 * pre-existing duplicates resolve deterministically). Used to keep saves
 * idempotent — one evaluation per employee per period.
 */
export async function getEvaluationByEmployeePeriod(
  employeeId: string,
  period: string,
): Promise<{ id: string } | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("performance_evaluations")
    .select("id")
    .eq("employee_id", employeeId)
    .eq("period", period)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

/** Delete an evaluation by id (RLS: performance.evaluate AND users.manage). */
export async function deleteEvaluation(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("performance_evaluations")
    .delete()
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function createEvaluation(
  input: Tables["performance_evaluations"]["Insert"],
): Promise<Tables["performance_evaluations"]["Row"]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("performance_evaluations")
    .insert(input)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateEvaluation(
  id: string,
  patch: Tables["performance_evaluations"]["Update"],
): Promise<Tables["performance_evaluations"]["Row"]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("performance_evaluations")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function listEvaluableEmployees(): Promise<
  { id: string; full_name: string; email: string }[]
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .eq("is_active", true)
    .in("role", ["employee", "section_head"])
    .order("full_name");
  if (error) throw new Error(error.message);
  return data ?? [];
}
