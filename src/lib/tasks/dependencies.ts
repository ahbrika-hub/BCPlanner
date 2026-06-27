import type { TaskStatus } from "@/lib/data/types";

/**
 * Block-START model (application-layer; the DB guard is untouched).
 *
 * A task ENTERS `in_progress` through exactly ONE application path: logging a
 * progress update (`addUpdateAction` → `task_updates` insert → the
 * `apply_task_update` trigger), which advances a task from `assigned`,
 * `approved`, or `pending_update` to `in_progress`. `transitionTaskAction` has
 * NO action whose target is `in_progress` (see ACTIONS), so the start gate lives
 * in `addUpdateAction`. These are the statuses from which a progress update would
 * START the task — the only ones the block-start check must guard.
 *
 * (The DB guard `validate_task_transition` also legally allows
 * `returned_for_modification → in_progress` and `reopened → in_progress`, but no
 * application path performs those: the trigger does not advance those statuses,
 * and no transition action targets `in_progress`. They are therefore unreachable
 * today; the check is keyed on the trigger's actual advancing set so it covers
 * every REAL path. See the report §5.)
 */
export const STARTABLE_STATUSES: readonly TaskStatus[] = [
  "assigned",
  "approved",
  "pending_update",
];

/** True when logging progress on a task in this status would start it (→ in_progress). */
export function isStartTransition(status: TaskStatus): boolean {
  return STARTABLE_STATUSES.includes(status);
}

/** A user-facing "blocked by …" message from incomplete blockers (or null). */
export function blockedStartMessage(
  blockers: { task_no: string | null }[],
): string | null {
  if (blockers.length === 0) return null;
  const labels = blockers.map((b) => b.task_no ?? "a task").join(", ");
  return `Blocked by ${labels} (not completed).`;
}
