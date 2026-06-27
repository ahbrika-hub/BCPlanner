// Windowed workload computation (pure, unit-tested). Reused by the Workload page
// (PR 2) and the create-task assignee-workload panel (PR 3). No DB access here.

import type { TaskStatus } from "@/lib/data/types";

/**
 * Daily capacity per working day. Capacity scales with the WORKING days in the
 * selected range (see countWorkingDays) — not calendar days.
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

/**
 * Utilization band cutoffs (hours vs capacity), shared by the SQL view, the TS
 * classifier, and the UI color cues so the three never drift:
 *   under (low)   : utilization < NEAR  (under capacity)
 *   near  (medium): NEAR ≤ utilization ≤ OVER  (near capacity)
 *   over  (high)  : utilization > OVER  (over capacity)
 */
export const UTILIZATION_BAND = { near: 80, over: 100 } as const;

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

/**
 * Inclusive count of WORKING days between two YYYY-MM-DD dates: the SAPTCO
 * work-week is Sunday–Thursday (Friday + Saturday excluded), MINUS any public
 * holidays that fall on an otherwise-working day. `holidays` is the set of
 * holiday dates (YYYY-MM-DD) in/around the range — callers fetch it from
 * public_holidays via listHolidayDates(). Omitting it preserves the original
 * work-week-only behavior. Returns 0 if invalid or inverted.
 *
 * This is the SINGLE source of truth for working-day/capacity math; every caller
 * (workload page, range workload aggregation, assignee-workload preview) inherits
 * the holiday adjustment by passing the holiday set here.
 */
export function countWorkingDays(
  from: string,
  to: string,
  holidays?: Iterable<string>,
): number {
  const start = Date.parse(`${isoDate(from)}T00:00:00Z`);
  const end = Date.parse(`${isoDate(to)}T00:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return 0;
  const holidaySet =
    holidays instanceof Set
      ? (holidays as Set<string>)
      : new Set(holidays ? [...holidays].map((d) => isoDate(d)) : []);
  let count = 0;
  for (let t = start; t <= end; t += 86_400_000) {
    const d = new Date(t);
    const dow = d.getUTCDay(); // 0=Sun … 5=Fri, 6=Sat
    if (dow === 5 || dow === 6) continue; // weekend
    if (holidaySet.has(fmt(d))) continue; // public holiday
    count += 1;
  }
  return count;
}

/**
 * Available hours over a range = 8h × working days (Sun–Thu minus public
 * holidays). Pass the holiday date set to subtract holidays from capacity.
 */
export function capacityHours(
  from: string,
  to: string,
  holidays?: Iterable<string>,
): number {
  return WORK_HOURS_PER_DAY * countWorkingDays(from, to, holidays);
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

/**
 * Classify load by HOURS-vs-capacity utilization % (not task count), per
 * UTILIZATION_BAND: over (>100) = high, near (80–100) = medium, else low.
 */
export function levelForUtilization(utilizationPct: number): WorkloadLevel {
  if (utilizationPct > UTILIZATION_BAND.over) return "high";
  if (utilizationPct >= UTILIZATION_BAND.near) return "medium";
  return "low";
}

/**
 * Aggregate one employee's active tasks over [from, to]. Capacity subtracts any
 * public holidays passed in `holidays`. Tasks with a NULL estimated_effort_hours
 * contribute 0 hours (we never fabricate effort) but are still counted in
 * active_task_count — the count is the secondary signal that flags estimate gaps.
 * The level is derived from utilization % (hours ÷ capacity), not the count.
 */
export function aggregateEmployeeWorkload(
  tasks: WorkloadTaskInput[],
  from: string,
  to: string,
  holidays?: Iterable<string>,
): WorkloadAggregate {
  const capacity = capacityHours(from, to, holidays);
  let count = 0;
  let hours = 0;
  for (const t of tasks) {
    const winStart = t.start_date ?? t.created_at;
    if (!taskOverlapsRange(winStart, t.due_date, from, to)) continue;
    count += 1;
    hours += Number(t.estimated_effort_hours ?? 0) || 0;
  }
  // Band off the RAW percentage (the rounded display value could flip an edge
  // case across the 80/100 cutoffs); keep the rounded value for display only.
  const rawUtilization = capacity > 0 ? (hours / capacity) * 100 : 0;
  const utilization_pct = Math.round(rawUtilization * 10) / 10;
  return {
    active_task_count: count,
    total_estimated_hours: Math.round(hours * 100) / 100,
    capacity_hours: capacity,
    utilization_pct,
    workload_level: levelForUtilization(rawUtilization),
  };
}

const pad = (n: number) => String(n).padStart(2, "0");
const fmt = (d: Date) =>
  `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

/**
 * Resolve a preset (anchored at `anchor` = today YYYY-MM-DD) into an inclusive
 * [from, to]. Week = the SAPTCO work-week Sunday→Thursday; Month = 1st→last day;
 * Today = the single day. Capacity over any range counts only Sun–Thu (see
 * capacityHours), so Fri/Sat add no capacity even inside Month/Custom ranges.
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
    // SAPTCO work-week: Sunday (start) → Thursday (start + 4 days).
    const dow = a.getUTCDay(); // 0=Sun
    const start = new Date(a);
    start.setUTCDate(a.getUTCDate() - dow);
    const end = new Date(start);
    end.setUTCDate(start.getUTCDate() + 4);
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
