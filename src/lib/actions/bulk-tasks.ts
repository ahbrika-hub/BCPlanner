"use server";

import { transitionTaskAction, type TransitionPayload } from "@/lib/actions/tasks";
import {
  ACTION_BY_NAME,
  BULK_ACTIONS,
  BULK_SELECTION_CAP,
  type TaskAction,
} from "@/lib/tasks/transitions";

/**
 * Bulk task transitions.
 *
 * THE INVARIANT: this processes each selected task by calling the EXISTING
 * single-task `transitionTaskAction` — never a blanket multi-row UPDATE, never a
 * service-role client, never a new transition code path. So the DB transition
 * guard (`guard_task_transition`), RLS, and the per-task permission check apply
 * to every task exactly as they do for a single action. This module imports
 * nothing from the data/supabase layer; its only effect is the loop below.
 *
 * Each task is processed INDEPENDENTLY: one failing (wrong state, not permitted,
 * not visible) neither blocks nor rolls back the others — failures are reported
 * per row and those tasks are left unchanged.
 */

export type BulkTaskResult = { taskId: string; ok: boolean; reason?: string };

export type BulkTransitionResult = {
  results: BulkTaskResult[];
  succeeded: number;
  failed: number;
  /** Set when the whole batch was refused up front (bad action / over the cap). */
  refused?: string;
};

export async function bulkTransitionTasks(
  taskIds: string[],
  action: TaskAction,
  payload: TransitionPayload = {},
): Promise<BulkTransitionResult> {
  const desc = ACTION_BY_NAME[action];
  if (!desc || !desc.to || !BULK_ACTIONS.includes(action)) {
    return { results: [], succeeded: 0, failed: 0, refused: "Unsupported bulk action." };
  }

  // De-duplicate while preserving order; ignore empties.
  const ids = [...new Set(taskIds.filter(Boolean))];
  if (ids.length === 0) {
    return { results: [], succeeded: 0, failed: 0, refused: "Nothing selected." };
  }
  if (ids.length > BULK_SELECTION_CAP) {
    return {
      results: [],
      succeeded: 0,
      failed: 0,
      refused: `Select at most ${BULK_SELECTION_CAP} tasks at once.`,
    };
  }

  const results: BulkTaskResult[] = [];
  // Sequential + independent: each task goes through the single-task action,
  // wrapped so an unexpected throw on one cannot abort the rest.
  for (const taskId of ids) {
    try {
      const res = await transitionTaskAction(taskId, action, payload);
      results.push(
        res.ok
          ? { taskId, ok: true }
          : { taskId, ok: false, reason: res.error },
      );
    } catch (e) {
      results.push({
        taskId,
        ok: false,
        reason: e instanceof Error ? e.message : "Something went wrong.",
      });
    }
  }

  const succeeded = results.filter((r) => r.ok).length;
  return { results, succeeded, failed: results.length - succeeded };
}
