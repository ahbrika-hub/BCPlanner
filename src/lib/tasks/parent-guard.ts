import type { TaskStatus } from "@/lib/data/types";

/**
 * Parent-completion guard model (application-layer; the DB guard is untouched).
 *
 * Rule: a PARENT task cannot ENTER `pending_review` (the submit-for-review step)
 * while any of its CHILD subtasks is still OPEN. The single real entry into
 * `pending_review` is `transitionTaskAction(id, "submit_review")` — the
 * `apply_task_update` trigger only ever advances to `in_progress`, and
 * `submit_review` is not a bulk action — so the check sits in that one action.
 *
 * "OPEN child" = a child whose status is NOT terminal. A terminal child (incl.
 * cancelled / rejected) never blocks the parent — otherwise a cancelled or
 * rejected child would deadlock the parent forever. This terminal set is the
 * deadlock-avoidance contract and is locked by the spec.
 *
 * (Defined here rather than reusing OVERDUE_EXCLUDED_STATUSES, which happens to
 * hold the same three values for an unrelated reason — keeping the meanings
 * decoupled so neither drifts if the other changes.)
 */
export const TERMINAL_STATUSES: readonly TaskStatus[] = [
  "completed",
  "cancelled",
  "rejected",
];

/** True when a child status still blocks the parent's submit-for-review. */
export function isOpenStatus(status: TaskStatus): boolean {
  return !TERMINAL_STATUSES.includes(status);
}

/** A user-facing "Has open subtasks: …" message from open children (or null). */
export function openSubtasksMessage(
  openChildren: { task_no: string | null }[],
): string | null {
  if (openChildren.length === 0) return null;
  const labels = openChildren.map((c) => c.task_no ?? "a subtask").join(", ");
  return `Has open subtasks: ${labels}.`;
}
