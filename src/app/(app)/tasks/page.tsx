import { listTasks } from "@/lib/data/tasks";
import { listBusinessLines } from "@/lib/data/business-lines";
import { listAssignableUsers } from "@/lib/data/profiles";
import { getCurrentProfile, getCurrentPermissions } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import type { TaskStatus, TaskPriority } from "@/lib/data/types";
import { PageHeader } from "@/components/layout/page-header";
import { TaskFilters } from "@/components/tasks/task-filters";
import { TasksTable } from "@/components/tasks/tasks-table";
import { NewTaskDialog } from "@/components/tasks/new-task-dialog";

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const status =
    typeof sp.status === "string" ? [sp.status as TaskStatus] : undefined;
  const priority =
    typeof sp.priority === "string" ? (sp.priority as TaskPriority) : undefined;
  const search = typeof sp.q === "string" ? sp.q : undefined;

  const [tasks, businessLines, users, profile] = await Promise.all([
    listTasks({ status, priority, search }),
    listBusinessLines(),
    listAssignableUsers(),
    getCurrentProfile(),
  ]);
  const permissions = profile ? await getCurrentPermissions() : [];

  return (
    <>
      <PageHeader
        title="Tasks"
        subtitle="Create, track, and manage tasks"
        actions={
          can("tasks.create", permissions) ? (
            <NewTaskDialog businessLines={businessLines} users={users} />
          ) : null
        }
      />

      <TaskFilters />

      {/* Assignee + Business Line filters and column sorting run client-side
          over the fetched rows. */}
      <TasksTable tasks={tasks} />
    </>
  );
}
