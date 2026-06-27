"use server";

import { revalidatePath } from "next/cache";

import { addDependencySchema } from "@/lib/validations";
import { getCurrentProfile, getCurrentPermissions } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { addDependency, removeDependency } from "@/lib/data/dependencies";
import type { ActionResult } from "@/lib/actions/tasks";

function fail(error: string): ActionResult {
  return { ok: false, error };
}

/**
 * Translate raw DB errors from the dependency insert into friendly messages. The
 * cycle/self guards are DB-enforced (a trigger + CHECK), so a malicious or buggy
 * client still can't persist a cycle — we just surface it nicely.
 */
function dependencyError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("cycle")) return "That would create a dependency cycle.";
  if (m.includes("itself") || m.includes("task_id_check"))
    return "A task cannot depend on itself.";
  if (m.includes("duplicate") || m.includes("unique"))
    return "That dependency already exists.";
  if (m.includes("row-level security") || m.includes("violates row-level"))
    return "You don't have access to link those tasks.";
  return "Could not add the dependency.";
}

export async function addDependencyAction(
  taskId: string,
  dependsOnTaskId: string,
): Promise<ActionResult> {
  const parsed = addDependencySchema.safeParse({
    task_id: taskId,
    depends_on_task_id: dependsOnTaskId,
  });
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  try {
    const profile = await getCurrentProfile();
    if (!profile) return fail("Not authenticated.");
    const permissions = await getCurrentPermissions();
    // Same key the task-edit path checks; RLS additionally requires visibility
    // of BOTH tasks (and re-checks tasks.update), so this is a friendly early gate.
    if (!can("tasks.update", permissions)) return fail("Not authorized.");

    await addDependency({
      task_id: parsed.data.task_id,
      depends_on_task_id: parsed.data.depends_on_task_id,
      created_by: profile.id,
    });

    revalidatePath(`/tasks/${parsed.data.task_id}`);
    return { ok: true, id: parsed.data.task_id };
  } catch (e) {
    return fail(dependencyError(e instanceof Error ? e.message : ""));
  }
}

export async function removeDependencyAction(
  id: string,
  taskId: string,
): Promise<ActionResult> {
  try {
    const profile = await getCurrentProfile();
    if (!profile) return fail("Not authenticated.");
    const permissions = await getCurrentPermissions();
    if (!can("tasks.update", permissions)) return fail("Not authorized.");

    // RLS (tasks.update + visibility of both tasks) governs whether the row is
    // actually deletable; an unauthorized caller simply affects 0 rows.
    await removeDependency(id);

    revalidatePath(`/tasks/${taskId}`);
    return { ok: true, id: taskId };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Could not remove the dependency.");
  }
}
