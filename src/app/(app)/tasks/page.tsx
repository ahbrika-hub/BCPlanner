import { listTasks } from "@/lib/data/tasks";
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
import { NewTaskDialog } from "@/components/tasks/new-task-dialog";
import { RequestTaskDialog } from "@/components/tasks/request-task-dialog";

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  // Server-side filters (need the DB / RLS scope): multi-status, priority,
  // full-text search, and the derived overdue toggle. Assignee, business-line,
  // and column sort are applied client-side in TasksTable (also URL-persisted).
  const status = parseStatusParam(sp.status);
  const priority =
    typeof sp.priority === "string" ? (sp.priority as TaskPriority) : undefined;
  const search = typeof sp.q === "string" ? sp.q : undefined;
  const overdue = sp.overdue === "1";

  const [tasks, businessLines, users, projects, templates, profile] =
    await Promise.all([
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
      getCurrentProfile(),
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
          profile?.role === "ceo" ? (
            // CEO gets the lightweight "Request a task" entry, not the full form.
            <RequestTaskDialog />
          ) : can("tasks.create", permissions) ? (
            <NewTaskDialog
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
