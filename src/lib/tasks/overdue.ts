import type { TaskStatus } from "@/lib/data/types";

/**
 * Canonical "overdue" definition — DERIVED, never a stored status.
 *
 *   overdue = due_date IS NOT NULL
 *             AND due_date < CURRENT_DATE
 *             AND status NOT IN ('completed','cancelled','rejected')
 *
 * This single definition is the source of truth for the /tasks overdue filter
 * and the overdue row badge, and MUST be reused by Prompt 5's "delayed" report
 * so the two never drift. The data layer mirrors it as PostgREST query
 * conditions (see listTasks); keep all three in sync.
 */
export const OVERDUE_EXCLUDED_STATUSES: readonly TaskStatus[] = [
  "completed",
  "cancelled",
  "rejected",
];

/** Today's date as `YYYY-MM-DD` (UTC), matching the `date`-typed due_date. */
export function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

/** True when a task is overdue per the canonical definition above. */
export function isOverdue(
  dueDate: string | null | undefined,
  status: TaskStatus,
): boolean {
  if (!dueDate) return false;
  if (OVERDUE_EXCLUDED_STATUSES.includes(status)) return false;
  // Both are date-only strings (YYYY-MM-DD); lexical compare is chronological.
  return dueDate < todayDateString();
}
