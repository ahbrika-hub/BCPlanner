"use server";

import { listTasks } from "@/lib/data/tasks";
import { getOverdueTasks } from "@/lib/data/analytics";
import { getCurrentProfile } from "@/lib/auth/session";
import { getDrilldownScope } from "@/lib/dashboard/drilldown-scope";
import type { TaskStatus } from "@/lib/data/types";

/**
 * Read-only drill-down for the Department dashboard. Reuses the existing
 * RLS-scoped read functions (listTasks / getOverdueTasks) — no new query
 * surface, no widening of access. Returns a slim row shape for the popup list.
 *
 * Role-scoped at this trust boundary (a UI gate alone is bypassable):
 *   • ceo               → NO drill-down: the executive view is a read-only
 *                         overview, so individual task details are never exposed
 *                         here even though the CEO holds tasks.read_all.
 *   • employee          → only their OWN tasks (RLS already restricts them, since
 *                         they lack tasks.read_all; we also scope explicitly).
 *   • section_head/admin → any task (current behaviour; relies on tasks.read_all).
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
  | { kind: "assignee-active"; assigneeId: string }
  // Project-health metrics (project detail page). Same role-scoping/trust
  // boundary as the dashboard keys: ceo → none, employee → own (RLS), managers
  // → all of the project's tasks.
  | { kind: "project-total"; projectId: string }
  | { kind: "project-status"; projectId: string; status: TaskStatus }
  | { kind: "project-overdue"; projectId: string };

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
  const profile = await getCurrentProfile();
  if (!profile) return [];
  const scope = getDrilldownScope(profile.role);
  // ceo → no task-detail drill-down (read-only executive overview).
  if (scope === "none") return [];
  // employee → only their OWN tasks. RLS already enforces this (they lack
  // tasks.read_all), but scope the queries explicitly as defence-in-depth.
  const ownId = scope === "own" ? profile.id : undefined;

  if (key.kind === "overdue") {
    const rows = await getOverdueTasks(50);
    return slim(ownId ? rows.filter((t) => t.assignee_id === ownId) : rows);
  }
  if (key.kind === "active") {
    return slim(
      await listTasks({ status: ACTIVE_STATUSES, assignee_id: ownId }),
    );
  }
  if (key.kind === "assignee-active") {
    // The active tasks behind one employee's workload (RLS-scoped to the viewer).
    // An employee can only ever target themselves.
    return slim(
      await listTasks({
        status: ACTIVE_STATUSES,
        assignee_id: ownId ?? key.assigneeId,
      }),
    );
  }
  if (key.kind === "project-total") {
    return slim(
      await listTasks({ project_id: key.projectId, assignee_id: ownId }),
    );
  }
  if (key.kind === "project-status") {
    return slim(
      await listTasks({
        project_id: key.projectId,
        status: [key.status],
        assignee_id: ownId,
      }),
    );
  }
  if (key.kind === "project-overdue") {
    return slim(
      await listTasks({
        project_id: key.projectId,
        overdue: true,
        assignee_id: ownId,
      }),
    );
  }
  return slim(await listTasks({ status: [key.status], assignee_id: ownId }));
}
