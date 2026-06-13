import "server-only";

import { createClient } from "@/lib/supabase/server";
import { isOverdue } from "@/lib/tasks/overdue";
import type { TaskStatus } from "./types";

/**
 * Per-project task rollup for the project health summary. RLS-scoped: read
 * through the caller's session client, so it reflects exactly what the viewer
 * may see. The detail page gates on tasks.read_all ({admin, section_head, ceo}),
 * who see all project tasks, so the rollup is the true department-wide picture.
 * The pure {@link aggregateProjectHealth} is unit-tested without a database.
 *
 * "overdue" reuses the canonical predicate (@/lib/tasks/overdue) verbatim — no
 * second rule. Read-only; no migration.
 */

export type ProjectHealth = {
  total: number;
  completed: number;
  inProgress: number;
  overdue: number;
  pendingReview: number;
  /** completed / total, as a whole percent. */
  completionPct: number;
  /** mean progress_percentage across all tasks, whole percent. */
  avgProgress: number;
  /** mean quality_rating over rated tasks (1dp), or null when none are rated. */
  avgQuality: number | null;
};

/** Minimal task shape the rollup needs (a structural subset of the DB row). */
export type ProjectHealthInput = {
  status: TaskStatus;
  due_date: string | null;
  progress_percentage: number | null;
  quality_rating: number | null;
};

export function aggregateProjectHealth(
  rows: ProjectHealthInput[],
): ProjectHealth {
  const total = rows.length;
  let completed = 0;
  let inProgress = 0;
  let overdue = 0;
  let pendingReview = 0;
  let progressSum = 0;
  const ratings: number[] = [];

  for (const r of rows) {
    if (r.status === "completed") completed += 1;
    if (r.status === "in_progress") inProgress += 1;
    if (r.status === "pending_review") pendingReview += 1;
    if (isOverdue(r.due_date, r.status)) overdue += 1;
    progressSum += r.progress_percentage ?? 0;
    if (r.quality_rating != null) ratings.push(r.quality_rating);
  }

  return {
    total,
    completed,
    inProgress,
    overdue,
    pendingReview,
    completionPct: total > 0 ? Math.round((completed / total) * 100) : 0,
    avgProgress: total > 0 ? Math.round(progressSum / total) : 0,
    avgQuality:
      ratings.length > 0
        ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) /
          10
        : null,
  };
}

export async function getProjectHealth(
  projectId: string,
): Promise<ProjectHealth> {
  const supabase = await createClient();
  // project_id is set only on project-type tasks (#37), so this is exactly the
  // project's task set. RLS on tasks applies under the session.
  const { data, error } = await supabase
    .from("tasks")
    .select("status, due_date, progress_percentage, quality_rating")
    .eq("project_id", projectId);
  if (error) throw new Error(error.message);
  return aggregateProjectHealth((data ?? []) as ProjectHealthInput[]);
}
