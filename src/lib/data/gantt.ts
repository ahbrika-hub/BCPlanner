import "server-only";

import { createClient } from "@/lib/supabase/server";
import type {
  GanttInputTask,
  GanttInputDependency,
} from "@/lib/tasks/gantt";

/**
 * Read-only fetch for the per-project Gantt: the project's tasks (the columns
 * the timeline needs) and the dependency rows touching them. Both run under the
 * caller's session client, so RLS scopes everything:
 *   • tasks → only project tasks the caller may see;
 *   • task_dependencies → only rows where the caller can see BOTH ends (so a
 *     dependency to an invisible task is silently excluded — no leak).
 * No writes, no migration.
 */
export async function getProjectGanttData(projectId: string): Promise<{
  tasks: GanttInputTask[];
  dependencies: GanttInputDependency[];
}> {
  const supabase = await createClient();

  const { data: taskData, error } = await supabase
    .from("tasks")
    .select("id, task_no, title, status, priority, start_date, due_date")
    .eq("project_id", projectId);
  if (error) throw new Error(error.message);
  const tasks = (taskData ?? []) as GanttInputTask[];

  const ids = tasks.map((t) => t.id);
  if (ids.length === 0) return { tasks, dependencies: [] };

  // Dependencies with either end among this project's tasks. ids are server-
  // generated UUIDs, so the in-list is safe to interpolate.
  const list = ids.join(",");
  const { data: depData, error: depErr } = await supabase
    .from("task_dependencies")
    .select("task_id, depends_on_task_id")
    .or(`task_id.in.(${list}),depends_on_task_id.in.(${list})`);
  if (depErr) throw new Error(depErr.message);

  return {
    tasks,
    dependencies: (depData ?? []) as GanttInputDependency[],
  };
}
