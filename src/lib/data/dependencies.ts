import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Tables, TaskStatus } from "./types";

/** A blocker/blocked task reference, as shown in the dependencies UI. */
export type DependencyRef = {
  /** task_dependencies row id (for removal). */
  id: string;
  task_id: string;
  depends_on_task_id: string;
  task: { id: string; task_no: string | null; title: string; status: TaskStatus };
};

const BLOCKER_SELECT =
  "id, task_id, depends_on_task_id, blocker:tasks!task_dependencies_depends_on_task_id_fkey(id, task_no, title, status)";
const BLOCKED_SELECT =
  "id, task_id, depends_on_task_id, blocked:tasks!task_dependencies_task_id_fkey(id, task_no, title, status)";

/**
 * Tasks that BLOCK the given task (its blockers). RLS only returns rows where the
 * caller can see both tasks, so this is visibility-scoped.
 */
export async function listBlockers(taskId: string): Promise<DependencyRef[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("task_dependencies")
    .select(BLOCKER_SELECT)
    .eq("task_id", taskId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => {
    const row = r as unknown as {
      id: string;
      task_id: string;
      depends_on_task_id: string;
      blocker: DependencyRef["task"];
    };
    return {
      id: row.id,
      task_id: row.task_id,
      depends_on_task_id: row.depends_on_task_id,
      task: row.blocker,
    };
  });
}

/**
 * Tasks that the given task BLOCKS (it is their blocker) — i.e. rows where this
 * task is depends_on_task_id. RLS-scoped.
 */
export async function listBlocking(taskId: string): Promise<DependencyRef[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("task_dependencies")
    .select(BLOCKED_SELECT)
    .eq("depends_on_task_id", taskId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => {
    const row = r as unknown as {
      id: string;
      task_id: string;
      depends_on_task_id: string;
      blocked: DependencyRef["task"];
    };
    return {
      id: row.id,
      task_id: row.task_id,
      depends_on_task_id: row.depends_on_task_id,
      task: row.blocked,
    };
  });
}

/**
 * The given task's blockers that are NOT yet completed — the set that gates
 * entering in_progress. Empty ⇒ not blocked. RLS-scoped (a blocker the caller
 * can't see won't appear; the block-start check fetches the task itself first,
 * so this runs in the caller's own visibility scope).
 */
export async function listIncompleteBlockers(
  taskId: string,
): Promise<{ task_no: string | null; title: string; status: TaskStatus }[]> {
  const blockers = await listBlockers(taskId);
  return blockers
    .filter((b) => b.task.status !== "completed")
    .map((b) => ({
      task_no: b.task.task_no,
      title: b.task.title,
      status: b.task.status,
    }));
}

export async function addDependency(
  input: Tables["task_dependencies"]["Insert"],
): Promise<Tables["task_dependencies"]["Row"]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("task_dependencies")
    .insert(input)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function removeDependency(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("task_dependencies")
    .delete()
    .eq("id", id);
  if (error) throw new Error(error.message);
}
