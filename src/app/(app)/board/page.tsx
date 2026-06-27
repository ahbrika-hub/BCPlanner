import { redirect } from "next/navigation";

import { listTasks } from "@/lib/data/tasks";
import { getCurrentPermissions } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { parseStatusParam } from "@/lib/tasks/status";
import type { TaskPriority } from "@/lib/data/types";
import { PageHeader } from "@/components/layout/page-header";
import { TaskFilters } from "@/components/tasks/task-filters";
import { ViewSwitcher } from "@/components/tasks/view-switcher";
import { KanbanBoard } from "@/components/tasks/kanban-board";

/**
 * Kanban board — an additive VIEW over the same RLS-scoped task data as the list
 * (`listTasks`), grouped into lanes. Dragging a card runs the EXISTING transition
 * action; this page only reads. Gated on `tasks.read` (employee/section_head/
 * admin), matching the standard Tasks list; the CEO oversight surface (which is
 * assignee-blind via a definer fn) is intentionally not reframed as a board, so
 * the CEO is sent to their /tasks view.
 */
export default async function BoardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const permissions = await getCurrentPermissions();
  if (!can("tasks.read", permissions)) redirect("/tasks");

  const sp = await searchParams;
  // Same server filters the list reads, so the board respects the shared filter
  // state (and RLS scope) — no parallel filtering path.
  const status = parseStatusParam(sp.status);
  const priority =
    typeof sp.priority === "string" ? (sp.priority as TaskPriority) : undefined;
  const search = typeof sp.q === "string" ? sp.q : undefined;
  const overdue = sp.overdue === "1";

  const tasks = await listTasks({
    status: status.length > 0 ? status : undefined,
    priority,
    search,
    overdue,
  });

  return (
    <>
      <PageHeader
        title="Board"
        subtitle="Drag a card to advance a task through its lifecycle"
        actions={<ViewSwitcher />}
      />
      <TaskFilters />
      <KanbanBoard tasks={tasks} permissions={permissions} />
    </>
  );
}
