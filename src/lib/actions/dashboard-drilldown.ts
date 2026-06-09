"use server";

import { listTasks } from "@/lib/data/tasks";
import { getOverdueTasks } from "@/lib/data/analytics";
import type { TaskStatus } from "@/lib/data/types";

/**
 * Read-only drill-down for the Department dashboard. Reuses the existing
 * RLS-scoped read functions (listTasks / getOverdueTasks) — no new query
 * surface, no widening of access. Returns a slim row shape for the popup list.
 */

export type DrilldownTask = {
  id: string;
  title: string;
  status: TaskStatus;
  due_date: string | null;
  estimated_effort_hours: number | null;
};

export type DrilldownKey =
  | { kind: "status"; status: TaskStatus }
  | { kind: "active" }
  | { kind: "overdue" }
  | { kind: "assignee-active"; assigneeId: string };

// Mirrors analytics' ACTIVE_STATUSES (the "in-flight" set the dashboard counts).
const ACTIVE_STATUSES: TaskStatus[] = [
  "assigned",
  "in_progress",
  "approved",
  "pending_update",
  "pending_review",
  "returned_for_modification",
  "reopened",
];

const slim = (
  rows: {
    id: string;
    title: string;
    status: TaskStatus;
    due_date: string | null;
    estimated_effort_hours: number | null;
  }[],
) =>
  rows.map((t) => ({
    id: t.id,
    title: t.title,
    status: t.status,
    due_date: t.due_date,
    estimated_effort_hours: t.estimated_effort_hours,
  }));

export async function fetchDrilldownTasks(
  key: DrilldownKey,
): Promise<DrilldownTask[]> {
  if (key.kind === "overdue") {
    return slim(await getOverdueTasks(50));
  }
  if (key.kind === "active") {
    return slim(await listTasks({ status: ACTIVE_STATUSES }));
  }
  if (key.kind === "assignee-active") {
    // The active tasks behind one employee's workload (RLS-scoped to the viewer).
    return slim(
      await listTasks({
        status: ACTIVE_STATUSES,
        assignee_id: key.assigneeId,
      }),
    );
  }
  return slim(await listTasks({ status: [key.status] }));
}
