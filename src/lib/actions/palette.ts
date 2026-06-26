"use server";

import { getCurrentProfile, getCurrentPermissions } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { listTasks } from "@/lib/data/tasks";
import { listBusinessLines } from "@/lib/data/business-lines";
import { listActiveProjects } from "@/lib/data/projects";
import { listAssignableUsers } from "@/lib/data/profiles";
import { listActiveTaskTemplates } from "@/lib/data/task-templates";
import type { NewTaskTemplate } from "@/components/tasks/new-task-dialog";
import type { BusinessLineRow, AssignableUser } from "@/lib/data/types";

export type PaletteTaskResult = {
  id: string;
  task_no: string | null;
  title: string;
};

const MAX_RESULTS = 8;

/**
 * Command-palette task search. Reuses the EXISTING full-text search path
 * (listTasks → search_vector / task_no trigram) so it is RLS-scoped to the
 * caller's visible tasks — no parallel query. Returns a slim, navigable shape.
 */
export async function searchTasksAction(
  query: string,
): Promise<PaletteTaskResult[]> {
  const profile = await getCurrentProfile();
  if (!profile) return [];
  const term = query.trim();
  if (!term) return [];

  const tasks = await listTasks({ search: term });
  return tasks.slice(0, MAX_RESULTS).map((t) => ({
    id: t.id,
    task_no: t.task_no,
    title: t.title,
  }));
}

export type TaskCreateData = {
  businessLines: BusinessLineRow[];
  users: AssignableUser[];
  projects: { id: string; name: string }[];
  templates: NewTaskTemplate[];
};

/**
 * Reference data for the EXISTING create-task dialog, fetched on demand when the
 * palette opens the create flow (the dialog component + createTaskAction are
 * reused unchanged). Returns null when the caller lacks tasks.create.
 */
export async function getTaskCreateDataAction(): Promise<TaskCreateData | null> {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  const permissions = await getCurrentPermissions();
  if (!can("tasks.create", permissions)) return null;

  const [businessLines, users, projects, templates] = await Promise.all([
    listBusinessLines(),
    listAssignableUsers(),
    listActiveProjects(),
    listActiveTaskTemplates(),
  ]);

  const templateOptions: NewTaskTemplate[] = can("templates.read", permissions)
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

  return { businessLines, users, projects, templates: templateOptions };
}
