"use server";

import { revalidatePath } from "next/cache";

import { taskTemplateSchema } from "@/lib/validations";
import { getCurrentProfile, getCurrentPermissions } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import {
  createTaskTemplate,
  updateTaskTemplate,
} from "@/lib/data/task-templates";
import type { Tables } from "@/lib/data/types";
import type { ActionResult } from "@/lib/actions/tasks";

function fail(error: string): ActionResult {
  return { ok: false, error };
}
function errMessage(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong.";
}

/** Gate + caller — write actions require templates.manage (admin/section_head). */
async function manager(): Promise<
  { profile: { id: string } } | { denied: ActionResult }
> {
  const profile = await getCurrentProfile();
  if (!profile) return { denied: fail("Not authenticated.") };
  const permissions = await getCurrentPermissions();
  if (!can("templates.manage", permissions))
    return { denied: fail("Not authorized.") };
  return { profile };
}

// Map validated defaults onto the table columns (undefined → null).
function toColumns(
  d: Tables["task_templates"]["Update"] & Record<string, unknown>,
): Tables["task_templates"]["Update"] {
  return {
    name: d.name,
    title: d.title ?? null,
    description: d.description ?? null,
    priority: d.priority ?? null,
    business_line_id: d.business_line_id ?? null,
    estimated_effort_hours: d.estimated_effort_hours ?? null,
  };
}

export async function createTaskTemplateAction(
  values: unknown,
): Promise<ActionResult> {
  const parsed = taskTemplateSchema.safeParse(values);
  if (!parsed.success)
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  const m = await manager();
  if ("denied" in m) return m.denied;
  try {
    const row = await createTaskTemplate({
      ...toColumns(parsed.data),
      created_by: m.profile.id,
    } as Tables["task_templates"]["Insert"]);
    revalidatePath("/admin/templates");
    revalidatePath("/tasks");
    return { ok: true, id: row.id };
  } catch (e) {
    return fail(errMessage(e));
  }
}

export async function updateTaskTemplateAction(
  id: string,
  values: unknown,
): Promise<ActionResult> {
  const parsed = taskTemplateSchema.safeParse(values);
  if (!parsed.success)
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  const m = await manager();
  if ("denied" in m) return m.denied;
  try {
    await updateTaskTemplate(id, toColumns(parsed.data));
    revalidatePath("/admin/templates");
    revalidatePath("/tasks");
    return { ok: true, id };
  } catch (e) {
    return fail(errMessage(e));
  }
}

export async function setTaskTemplateActiveAction(
  id: string,
  isActive: boolean,
): Promise<ActionResult> {
  const m = await manager();
  if ("denied" in m) return m.denied;
  try {
    await updateTaskTemplate(id, { is_active: isActive });
    revalidatePath("/admin/templates");
    revalidatePath("/tasks");
    return { ok: true, id };
  } catch (e) {
    return fail(errMessage(e));
  }
}
