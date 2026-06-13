import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  isOverdue,
  todayDateString,
  OVERDUE_EXCLUDED_STATUSES,
} from "@/lib/tasks/overdue";
import type { TaskStatus, TaskPriority } from "./types";

const DELAYED_SELECT = `
  *,
  assignee:profiles!tasks_assignee_id_fkey(id, full_name),
  business_line:business_lines!tasks_business_line_id_fkey(id, name)
`;

export type DelayedFilters = {
  /** Inclusive due-date lower bound (YYYY-MM-DD). */
  from?: string;
  /** Inclusive due-date upper bound (YYYY-MM-DD). */
  to?: string;
  business_line_id?: string;
  assignee_id?: string;
};

/** A delayed row plus its derived whole-day lateness. */
export type DelayedTask = {
  id: string;
  task_no: string | null;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  assignee_name: string | null;
  business_line_name: string | null;
  delay_days: number;
};

export type Breakdown = { label: string; count: number };

export type DelayedReport = {
  delayedCount: number;
  onTrackCount: number;
  maxDelayDays: number;
  avgDelayDays: number | null;
  byEmployee: Breakdown[];
  byBusinessLine: Breakdown[];
  byPriority: Breakdown[];
  /** Two-bar comparison data: Delayed vs On track (open tasks). */
  completion: Breakdown[];
  /** Delayed rows only, sorted by delay (most overdue first). */
  tasks: DelayedTask[];
};

/** The minimal row shape the aggregator needs (a structural subset of the DB row). */
export type DelayedInput = {
  id: string;
  task_no: string | null;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  assignee: { full_name: string | null } | null;
  business_line: { name: string } | null;
};

/** Whole days a date-only `due_date` is behind `today` (never negative). */
export function delayDays(dueDate: string, today: string): number {
  const ms =
    Date.parse(`${today}T00:00:00Z`) - Date.parse(`${dueDate}T00:00:00Z`);
  return Math.max(0, Math.round(ms / 86_400_000));
}

function toSortedBreakdown(counts: Map<string, number>): Breakdown[] {
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

/**
 * Pure aggregation over open tasks, using the canonical overdue predicate so a
 * "delayed" task is exactly an overdue one. Terminal statuses
 * (completed/cancelled/rejected) are neither delayed nor on-track — they are
 * excluded entirely, matching the DB-side filter in {@link getDelayedReport}.
 */
export function aggregateDelayed(
  rows: DelayedInput[],
  today: string,
): DelayedReport {
  const delayed: DelayedTask[] = [];
  let onTrackCount = 0;
  const byEmployee = new Map<string, number>();
  const byBusinessLine = new Map<string, number>();
  const byPriority = new Map<string, number>();

  for (const r of rows) {
    if (OVERDUE_EXCLUDED_STATUSES.includes(r.status)) continue;
    if (!isOverdue(r.due_date, r.status)) {
      onTrackCount++;
      continue;
    }
    const employee = r.assignee?.full_name ?? "Unassigned";
    const line = r.business_line?.name ?? "Unassigned";
    byEmployee.set(employee, (byEmployee.get(employee) ?? 0) + 1);
    byBusinessLine.set(line, (byBusinessLine.get(line) ?? 0) + 1);
    byPriority.set(r.priority, (byPriority.get(r.priority) ?? 0) + 1);
    delayed.push({
      id: r.id,
      task_no: r.task_no,
      title: r.title,
      status: r.status,
      priority: r.priority,
      due_date: r.due_date,
      assignee_name: r.assignee?.full_name ?? null,
      business_line_name: r.business_line?.name ?? null,
      // due_date is non-null here (isOverdue guarantees it).
      delay_days: delayDays(r.due_date as string, today),
    });
  }

  delayed.sort((a, b) => b.delay_days - a.delay_days);
  const days = delayed.map((t) => t.delay_days);
  const avgDelayDays =
    days.length > 0
      ? Math.round((days.reduce((a, b) => a + b, 0) / days.length) * 10) / 10
      : null;

  return {
    delayedCount: delayed.length,
    onTrackCount,
    maxDelayDays: days.length > 0 ? Math.max(...days) : 0,
    avgDelayDays,
    byEmployee: toSortedBreakdown(byEmployee),
    byBusinessLine: toSortedBreakdown(byBusinessLine),
    byPriority: toSortedBreakdown(byPriority),
    completion: [
      { label: "Delayed", count: delayed.length },
      { label: "On track", count: onTrackCount },
    ],
    tasks: delayed,
  };
}

/**
 * Department-wide delayed-tasks report. RLS-scoped read; the DB query restricts
 * to open tasks (canonical excluded statuses can never be delayed), reusing the
 * (status, due_date) index added in Prompt 3. Aggregation is delegated to the
 * pure {@link aggregateDelayed} so it is unit-tested without a database.
 */
export async function getDelayedReport(
  filters: DelayedFilters = {},
): Promise<DelayedReport> {
  const supabase = await createClient();
  let q = supabase
    .from("tasks")
    .select(DELAYED_SELECT)
    .not("status", "in", `(${OVERDUE_EXCLUDED_STATUSES.join(",")})`);

  if (filters.from) q = q.gte("due_date", filters.from);
  if (filters.to) q = q.lte("due_date", filters.to);
  if (filters.business_line_id)
    q = q.eq("business_line_id", filters.business_line_id);
  if (filters.assignee_id) q = q.eq("assignee_id", filters.assignee_id);

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return aggregateDelayed(
    (data ?? []) as unknown as DelayedInput[],
    todayDateString(),
  );
}