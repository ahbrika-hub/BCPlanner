"use server";

import { revalidatePath } from "next/cache";

import {
  projectTemplateSchema,
  createProjectFromTemplateSchema,
} from "@/lib/validations";
import { getCurrentProfile, getCurrentPermissions } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import {
  createProjectTemplate,
  updateProjectTemplate,
  deleteProjectTemplate,
  setTemplateTasks,
  getProjectTemplate,
} from "@/lib/data/project-templates";
import { createProjectAction } from "@/lib/actions/projects";
import { createTaskAction, type ActionResult } from "@/lib/actions/tasks";

function fail(error: string): ActionResult {
  return { ok: false, error };
}
function errMessage(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong.";
}

// Writes require projects.manage (admin + section_head) — same gate as projects.
async function ensureManager(): Promise<
  { profile: { id: string } } | { denied: ActionResult }
> {
  const profile = await getCurrentProfile();
  if (!profile) return { denied: fail("Not authenticated.") };
  const permissions = await getCurrentPermissions();
  if (!can("projects.manage", permissions))
    return { denied: fail("Not authorized.") };
  return { profile };
}

export async function createProjectTemplateAction(
  values: unknown,
): Promise<ActionResult> {
  const parsed = projectTemplateSchema.safeParse(values);
  if (!parsed.success)
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  const m = await ensureManager();
  if ("denied" in m) return m.denied;
  try {
    const tpl = await createProjectTemplate({
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      created_by: m.profile.id,
    });
    try {
      await setTemplateTasks(tpl.id, parsed.data.tasks);
    } catch (e) {
      // Don't leave a parent with no task defs — roll the template back.
      await deleteProjectTemplate(tpl.id).catch(() => {});
      throw e;
    }
    revalidatePath("/admin/project-templates");
    return { ok: true, id: tpl.id };
  } catch (e) {
    return fail(errMessage(e));
  }
}

export async function updateProjectTemplateAction(
  id: string,
  values: unknown,
): Promise<ActionResult> {
  const parsed = projectTemplateSchema.safeParse(values);
  if (!parsed.success)
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  const m = await ensureManager();
  if ("denied" in m) return m.denied;
  try {
    await updateProjectTemplate(id, {
      name: parsed.data.name,
      description: parsed.data.description ?? null,
    });
    await setTemplateTasks(id, parsed.data.tasks);
    revalidatePath("/admin/project-templates");
    return { ok: true, id };
  } catch (e) {
    return fail(errMessage(e));
  }
}

export async function setProjectTemplateActiveAction(
  id: string,
  isActive: boolean,
): Promise<ActionResult> {
  const m = await ensureManager();
  if ("denied" in m) return m.denied;
  try {
    await updateProjectTemplate(id, { is_active: isActive });
    revalidatePath("/admin/project-templates");
    return { ok: true, id };
  } catch (e) {
    return fail(errMessage(e));
  }
}

export type GenerateFromTemplateResult =
  | { ok: true; projectId: string; createdCount: number }
  | {
      ok: false;
      error: string;
      projectId?: string;
      createdCount?: number;
    };

/**
 * Create a real project from a template, then generate each template task via the
 * EXISTING task-creation path (createProjectAction + createTaskAction) — so every
 * generated task gets a real TSS-BC number, a role-correct starting status, and
 * passes the transition guard. No raw bulk insert.
 *
 * Atomicity: each action is its own transaction (the brief forbids a bulk-insert /
 * service-role path), so the project + N tasks are not one DB transaction. We
 * validate everything up front and, on any per-task failure, return ok:false with
 * the project id and the count created — surfacing a partial build rather than
 * leaving it silent.
 */
export async function createProjectFromTemplateAction(
  values: unknown,
): Promise<GenerateFromTemplateResult> {
  const parsed = createProjectFromTemplateSchema.safeParse(values);
  if (!parsed.success)
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  const m = await ensureManager();
  if ("denied" in m)
    return {
      ok: false,
      error: m.denied.ok === false ? m.denied.error : "Not authorized.",
    };

  try {
    const template = await getProjectTemplate(parsed.data.template_id);
    if (!template || !template.is_active)
      return { ok: false, error: "Template not found or inactive." };
    if (template.tasks.length === 0)
      return { ok: false, error: "Template has no tasks." };

    // 1) Create the project through the existing action.
    const projectRes = await createProjectAction({
      name: parsed.data.name,
      business_line_id: parsed.data.business_line_id,
    });
    if (!projectRes.ok || !projectRes.id)
      return {
        ok: false,
        error: projectRes.ok ? "Project creation returned no id." : projectRes.error,
      };
    const projectId = projectRes.id;

    // 2) Generate each task through the existing create-task action.
    let createdCount = 0;
    const failures: string[] = [];
    for (const def of template.tasks) {
      const res = await createTaskAction({
        title: def.title,
        description: def.description ?? undefined,
        priority: def.priority ?? "medium",
        business_line_id: def.business_line_id ?? undefined,
        estimated_effort_hours: def.estimated_effort_hours ?? undefined,
        task_category: "project",
        project_id: projectId,
      });
      if (res.ok) createdCount += 1;
      else failures.push(`${def.title}: ${res.error}`);
    }

    revalidatePath("/admin/projects");
    revalidatePath("/tasks");

    if (failures.length > 0) {
      return {
        ok: false,
        error: `Project created, but ${failures.length} of ${template.tasks.length} tasks failed: ${failures.join("; ")}`,
        projectId,
        createdCount,
      };
    }
    return { ok: true, projectId, createdCount };
  } catch (e) {
    return { ok: false, error: errMessage(e) };
  }
}
