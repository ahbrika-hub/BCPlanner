"use server";

import { revalidatePath } from "next/cache";

import { createProjectSchema } from "@/lib/validations";
import { getCurrentProfile, getCurrentPermissions } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { createProject, updateProject } from "@/lib/data/projects";
import type { ActionResult } from "@/lib/actions/tasks";

function fail(error: string): ActionResult {
  return { ok: false, error };
}
function errMessage(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong.";
}

async function ensureManager(): Promise<ActionResult | null> {
  const profile = await getCurrentProfile();
  if (!profile) return fail("Not authenticated.");
  const permissions = await getCurrentPermissions();
  if (!can("projects.manage", permissions)) return fail("Not authorized.");
  return null;
}

export async function createProjectAction(
  values: unknown,
): Promise<ActionResult> {
  const parsed = createProjectSchema.safeParse(values);
  if (!parsed.success)
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  const denied = await ensureManager();
  if (denied) return denied;
  try {
    const row = await createProject({
      name: parsed.data.name,
      business_line_id: parsed.data.business_line_id ?? null,
    });
    revalidatePath("/admin/projects");
    return { ok: true, id: row.id };
  } catch (e) {
    return fail(errMessage(e));
  }
}

export async function setProjectActiveAction(
  id: string,
  isActive: boolean,
): Promise<ActionResult> {
  const denied = await ensureManager();
  if (denied) return denied;
  try {
    await updateProject(id, { is_active: isActive });
    revalidatePath("/admin/projects");
    return { ok: true, id };
  } catch (e) {
    return fail(errMessage(e));
  }
}
