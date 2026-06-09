"use server";

import { revalidatePath } from "next/cache";

import {
  createRecurringSchema,
  updateRecurringSchema,
} from "@/lib/validations";
import { getCurrentProfile, getCurrentPermissions } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import {
  createRecurringTask,
  updateRecurringTask,
  softDeleteRecurringTask,
  restoreRecurringTask,
  generateDueTasks,
} from "@/lib/data/recurring";
import type { ActionResult } from "@/lib/actions/tasks";
import type { Tables } from "@/lib/data/types";

function fail(error: string): ActionResult {
  return { ok: false, error };
}
function errMessage(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong.";
}

async function ensureManager(): Promise<{ id: string } | ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return fail("Not authenticated.");
  const permissions = await getCurrentPermissions();
  if (!can("recurring.manage", permissions)) return fail("Not authorized.");
  return { id: profile.id };
}

export async function createRecurringAction(
  values: unknown,
): Promise<ActionResult> {
  const parsed = createRecurringSchema.safeParse(values);
  if (!parsed.success)
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  const actor = await ensureManager();
  if ("ok" in actor) return actor;
  try {
    const d = parsed.data;
    const row = await createRecurringTask({
      ...d,
      next_generation_date: d.next_generation_date ?? d.start_date,
      created_by: actor.id,
    });
    revalidatePath("/recurring");
    return { ok: true, id: row.id };
  } catch (e) {
    return fail(errMessage(e));
  }
}

export async function updateRecurringAction(
  id: string,
  values: unknown,
): Promise<ActionResult> {
  const parsed = updateRecurringSchema.safeParse(values);
  if (!parsed.success)
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  const actor = await ensureManager();
  if ("ok" in actor) return actor;
  try {
    await updateRecurringTask(
      id,
      parsed.data as Tables["recurring_tasks"]["Update"],
    );
    revalidatePath("/recurring");
    return { ok: true, id };
  } catch (e) {
    return fail(errMessage(e));
  }
}

/** Soft-delete (reversible). The row is hidden from lists and stops generating. */
export async function deleteRecurringAction(id: string): Promise<ActionResult> {
  const actor = await ensureManager();
  if ("ok" in actor) return actor;
  try {
    await softDeleteRecurringTask(id);
    revalidatePath("/recurring");
    return { ok: true, id };
  } catch (e) {
    return fail(errMessage(e));
  }
}

/** Restore a soft-deleted template (used by the Undo toast and Restore button). */
export async function restoreRecurringAction(
  id: string,
): Promise<ActionResult> {
  const actor = await ensureManager();
  if ("ok" in actor) return actor;
  try {
    await restoreRecurringTask(id);
    revalidatePath("/recurring");
    return { ok: true, id };
  } catch (e) {
    return fail(errMessage(e));
  }
}

export async function generateNowAction(): Promise<
  ActionResult & { count?: number }
> {
  const actor = await ensureManager();
  if ("ok" in actor) return actor;
  try {
    const count = await generateDueTasks();
    revalidatePath("/recurring");
    revalidatePath("/tasks");
    return { ok: true, count };
  } catch (e) {
    return fail(errMessage(e));
  }
}
