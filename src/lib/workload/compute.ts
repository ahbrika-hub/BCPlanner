// Windowed workload computation (pure, unit-tested). Reused by the Workload page
// (PR 2) and the create-task assignee-workload panel (PR 3). No DB access here.

import type { TaskStatus } from "@/lib/data/types";

/**
 * Daily capacity per employee. The old daily_employee_workload view used 8h as a
 * single-day capacity; here capacity scales with the selected range.
 *
 * FLAG: this counts CALENDAR days × 8h. The SAPTCO work-week (Sun–Thu vs Mon–Fri)
 * is unconfirmed — "This week" boundaries and the working-days capacity should be
 * revisited once the official work-week is confirmed.
 */
export const WORK_HOURS_PER_DAY = 8;

// The "in-flight" statuses, identical to the daily_employee_workload view.
export const ACTIVE_TASK_STATUSES: TaskStatus[] = [
  "assigned",
  "in_progress",
  "approved",
  "pending_update",
  "pending_review",
  "returned_for_modification",
  "reopened",
];

export type WorkloadPreset = "today" | "week" | "month" | "custom";
export type WorkloadRange = { from: string; to: string; preset: WorkloadPreset };

export type WorkloadLevel = "low" | "medium" | "high";

export type WorkloadAggregate = {
  active_task_count: number;
  total_estimated_hours: number;
  capacity_hours: number;
  utilization_pct: number;
  workload_level: WorkloadLevel;
};

/** A task as needed by the windowed aggregation (no identity/title — privacy). */
export type WorkloadTaskInput = {
  estimated_effort_hours: number | string | null;
  start_date: string | null;
  due_date: string | null;
  created_at: string;
};

const isoDate = (s: string) => s.slice(0, 10);

/** Inclusive calendar-day count between two YYYY-MM-DD dates (0 if invalid/empty). */
export function calendarDays(from: string, to: string): number {
  const ms =
    Date.parse(`${isoDate(to)}T00:00:00Z`) -
    Date.parse(`${isoDate(from)}T00:00:00Z`);
  if (Number.isNaN(ms) || ms < 0) return 0;
  return Math.floor(ms / 86_400_000) + 1;
}

export function capacityHours(from: string, to: string): number {
  return WORK_HOURS_PER_DAY * calendarDays(from, to);
}

/**
 * Does a task's [winStart, due] window overlap the inclusive range [from, to]?
 * winStart = start_date ?? created_at; a null due date is treated as open-ended.
 */
export function taskOverlapsRange(
  winStart: string,
  dueDate: string | null,
  from: string,
  to: string,
): boolean {
  const ws = isoDate(winStart);
  if (ws > isoDate(to)) return false; // starts after the range
  if (dueDate != null && isoDate(dueDate) < isoDate(from)) return false; // ended before
  return true;
}

function levelFor(count: number): WorkloadLevel {
  // Same thresholds as the daily_employee_workload view (>5 high, >2 medium).
  if (count > 5) return "high";
  if (count > 2) return "medium";
  return "low";
}

/** Aggregate one employee's active tasks over [from, to]. */
export function aggregateEmployeeWorkload(
  tasks: WorkloadTaskInput[],
  from: string,
  to: string,
): WorkloadAggregate {
  const capacity = capacityHours(from, to);
  let count = 0;
  let hours = 0;
  for (const t of tasks) {
    const winStart = t.start_date ?? t.created_at;
    if (!taskOverlapsRange(winStart, t.due_date, from, to)) continue;
    count += 1;
    hours += Number(t.estimated_effort_hours ?? 0) || 0;
  }
  const utilization_pct =
    capacity > 0 ? Math.round((hours / capacity) * 1000) / 10 : 0;
  return {
    active_task_count: count,
    total_estimated_hours: Math.round(hours * 100) / 100,
    capacity_hours: capacity,
    utilization_pct,
    workload_level: levelFor(count),
  };
}

const pad = (n: number) => String(n).padStart(2, "0");
const fmt = (d: Date) =>
  `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

/**
 * Resolve a preset (anchored at `anchor` = today YYYY-MM-DD) into an inclusive
 * [from, to]. Week = Sunday→Saturday calendar week; Month = 1st→last day.
 * FLAG: week boundaries assume a Sun–Sat calendar week; confirm the SAPTCO
 * work-week before treating these as working ranges.
 */
export function resolveWorkloadRange(
  preset: WorkloadPreset,
  anchor: string,
  customFrom?: string,
  customTo?: string,
): WorkloadRange {
  const a = new Date(`${isoDate(anchor)}T00:00:00Z`);
  if (preset === "today") {
    return { from: anchor, to: anchor, preset };
  }
  if (preset === "week") {
    const dow = a.getUTCDay(); // 0=Sun
    const start = new Date(a);
    start.setUTCDate(a.getUTCDate() - dow);
    const end = new Date(start);
    end.setUTCDate(start.getUTCDate() + 6);
    return { from: fmt(start), to: fmt(end), preset };
  }
  if (preset === "month") {
    const start = new Date(
      Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), 1),
    );
    const end = new Date(
      Date.UTC(a.getUTCFullYear(), a.getUTCMonth() + 1, 0),
    );
    return { from: fmt(start), to: fmt(end), preset };
  }
  // custom — fall back to the anchor day if a bound is missing/invalid
  const from = customFrom && /^\d{4}-\d{2}-\d{2}$/.test(customFrom) ? customFrom : anchor;
  const to = customTo && /^\d{4}-\d{2}-\d{2}$/.test(customTo) ? customTo : from;
  // normalise inverted ranges
  return from <= to ? { from, to, preset: "custom" } : { from: to, to: from, preset: "custom" };
}
