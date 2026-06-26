"use server";

import { revalidatePath } from "next/cache";

import {
  createSavedViewSchema,
  renameSavedViewSchema,
  updateSavedViewConfigSchema,
} from "@/lib/validations";
import { getCurrentUser } from "@/lib/auth/session";
import {
  createSavedView,
  updateSavedView,
  deleteSavedView,
} from "@/lib/data/saved-views";
import type { ActionResult } from "@/lib/actions/tasks";

function fail(error: string): ActionResult {
  return { ok: false, error };
}

function errMessage(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong.";
}

/**
 * Saved views are private per-user data, so there is NO permission key and no
 * authorize() call: an authenticated session plus owner-scoped RLS
 * (user_id = auth.uid()) is the gate. Each action confirms a session, then lets
 * RLS enforce ownership — a non-owner's update/delete simply affects 0 rows.
 */

export async function createSavedViewAction(
  values: unknown,
): Promise<ActionResult> {
  const parsed = createSavedViewSchema.safeParse(values);
  if (!parsed.success)
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  const user = await getCurrentUser();
  if (!user) return fail("Not authenticated.");
  try {
    const row = await createSavedView({
      user_id: user.id,
      name: parsed.data.name,
      config: parsed.data.config,
    });
    revalidatePath("/tasks");
    return { ok: true, id: row.id };
  } catch (e) {
    return fail(errMessage(e));
  }
}

export async function renameSavedViewAction(
  values: unknown,
): Promise<ActionResult> {
  const parsed = renameSavedViewSchema.safeParse(values);
  if (!parsed.success)
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  const user = await getCurrentUser();
  if (!user) return fail("Not authenticated.");
  try {
    const row = await updateSavedView(parsed.data.id, {
      name: parsed.data.name,
    });
    revalidatePath("/tasks");
    return { ok: true, id: row.id };
  } catch (e) {
    return fail(errMessage(e));
  }
}

/** Re-save the current filter/sort over an existing view (inline edit = re-save). */
export async function updateSavedViewConfigAction(
  values: unknown,
): Promise<ActionResult> {
  const parsed = updateSavedViewConfigSchema.safeParse(values);
  if (!parsed.success)
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  const user = await getCurrentUser();
  if (!user) return fail("Not authenticated.");
  try {
    const row = await updateSavedView(parsed.data.id, {
      config: parsed.data.config,
    });
    revalidatePath("/tasks");
    return { ok: true, id: row.id };
  } catch (e) {
    return fail(errMessage(e));
  }
}

export async function deleteSavedViewAction(id: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return fail("Not authenticated.");
  try {
    await deleteSavedView(id);
    revalidatePath("/tasks");
    return { ok: true };
  } catch (e) {
    return fail(errMessage(e));
  }
}
