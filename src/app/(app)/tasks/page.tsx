import {
  listTasks,
  getCeoDepartmentTasks,
} from "@/lib/data/tasks";
import { listBusinessLines } from "@/lib/data/business-lines";
import { listActiveProjects } from "@/lib/data/projects";
import { listActiveTaskTemplates } from "@/lib/data/task-templates";
import { listAssignableUsers } from "@/lib/data/profiles";
import { getCurrentProfile, getCurrentPermissions } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { parseStatusParam } from "@/lib/tasks/status";
import type { TaskPriority } from "@/lib/data/types";
import { PageHeader } from "@/components/layout/page-header";
import { TaskFilters } from "@/components/tasks/task-filters";
import { TasksTable } from "@/components/tasks/tasks-table";
import { CeoTasksView } from "@/components/tasks/ceo-tasks-view";
import { NewTaskDialogLazy } from "@/components/tasks/new-task-dialog-lazy";
import { RequestTaskDialog } from "@/components/tasks/request-task-dialog";

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const profile = await getCurrentProfile();

  // CEO oversight: ALL department tasks with NO assignee identity (server-side),
  // plus the lightweight "Request a task" entry and "Request update" on his own
  // requests. A separate surface from the dashboard (whose drilldown stays off).
  if (profile?.role === "ceo") {
    const ceoTasks = await getCeoDepartmentTasks();
    return (
      <>
        <PageHeader
          title="Tasks"
          subtitle="Department oversight"
          actions={<RequestTaskDialog />}
        />
        <CeoTasksView tasks={ceoTasks} />
      </>
    );
  }

  const sp = await searchParams;
  // Server-side filters (need the DB / RLS scope): multi-status, priority,
  // full-text search, and the derived overdue toggle. Assignee, business-line,
  // and column sort are applied client-side in TasksTable (also URL-persisted).
  const status = parseStatusParam(sp.status);
  const priority =
    typeof sp.priority === "string" ? (sp.priority as TaskPriority) : undefined;
  const search = typeof sp.q === "string" ? sp.q : undefined;
  const overdue = sp.overdue === "1";

  const [tasks, businessLines, users, projects, templates] = await Promise.all([
    listTasks({
      status: status.length > 0 ? status : undefined,
      priority,
      search,
      overdue,
    }),
    listBusinessLines(),
    listAssignableUsers(),
    listActiveProjects(),
    listActiveTaskTemplates(),
  ]);
  const permissions = profile ? await getCurrentPermissions() : [];

  // Templates pre-fill the create form; readable by all task creators
  // (templates.read). Mapped to the slim, serializable shape the dialog needs.
  const templateOptions = can("templates.read", permissions)
    ? templates.map((t) => ({
        id: t.id,
        name: t.name,
        title: t.title,
        description: t.description,
        priority: t.priority,
        business_line_id: t.business_line_id,
        estimated_effort_hours: t.estimated_effort_hours,
      }))
    : [];

  return (
    <>
      <PageHeader
        title="Tasks"
        subtitle="Create, track, and manage tasks"
        actions={
          can("tasks.create", permissions) ? (
            <NewTaskDialogLazy
              businessLines={businessLines}
              users={users}
              projects={projects}
              templates={templateOptions}
            />
          ) : null
        }
      />

      <TaskFilters />

      {/* Assignee + Business Line filters and column sorting run client-side
          over the fetched rows (URL-persisted via the History API). */}
      <TasksTable tasks={tasks} />
    </>
  );
}
