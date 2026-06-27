import { redirect } from "next/navigation";

import { listTasks } from "@/lib/data/tasks";
import { getCurrentPermissions } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { parseStatusParam } from "@/lib/tasks/status";
import { todayDateString } from "@/lib/tasks/overdue";
import type { TaskPriority } from "@/lib/data/types";
import { PageHeader } from "@/components/layout/page-header";
import { TaskFilters } from "@/components/tasks/task-filters";
import { ViewSwitcher } from "@/components/tasks/view-switcher";
import { PlanningCalendar } from "@/components/tasks/planning-calendar";

/**
 * Planning calendar — a read-only VIEW over the same RLS-scoped task data as the
 * list, plotting tasks on their due_date. No writes, no drag/reschedule in this
 * PR. Gated on `tasks.read`, matching the list (CEO → /tasks oversight view).
 */
export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const permissions = await getCurrentPermissions();
  if (!can("tasks.read", permissions)) redirect("/tasks");

  const sp = await searchParams;
  // Same server filters the list reads → shared filter state + RLS scope.
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
        title="Calendar"
        subtitle="Tasks plotted on their due dates (read-only)"
        actions={<ViewSwitcher />}
      />
      <TaskFilters />
      <PlanningCalendar tasks={tasks} todayStr={todayDateString()} />
    </>
  );
}
