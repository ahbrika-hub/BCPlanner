"use server";

import { revalidatePath } from "next/cache";

import { createEvaluationSchema } from "@/lib/validations";
import { getCurrentProfile, getCurrentPermissions } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import {
  computeEmployeeMetrics,
  createEvaluation,
  updateEvaluation,
  type ComputedMetrics,
} from "@/lib/data/performance";
import type { ActionResult } from "@/lib/actions/tasks";

export async function previewMetricsAction(
  employeeId: string,
  period: string,
): Promise<{ ok: boolean; metrics?: ComputedMetrics; error?: string }> {
  try {
    const profile = await getCurrentProfile();
    if (!profile) return { ok: false, error: "Not authenticated." };
    const permissions = await getCurrentPermissions();
    if (!can("performance.evaluate", permissions)) {
      return { ok: false, error: "Not authorized." };
    }
    const metrics = await computeEmployeeMetrics(employeeId, period);
    return { ok: true, metrics };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to compute metrics.",
    };
  }
}

function fail(error: string): ActionResult {
  return { ok: false, error };
}
function errMessage(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong.";
}

export async function createEvaluationAction(
  values: unknown,
): Promise<ActionResult> {
  const parsed = createEvaluationSchema.safeParse(values);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  try {
    const profile = await getCurrentProfile();
    if (!profile) return fail("Not authenticated.");
    const permissions = await getCurrentPermissions();
    if (!can("performance.evaluate", permissions))
      return fail("Not authorized.");

    const m = await computeEmployeeMetrics(
      parsed.data.employee_id,
      parsed.data.period,
    );
    const row = await createEvaluation({
      employee_id: parsed.data.employee_id,
      period: parsed.data.period,
      evaluated_by: profile.id,
      evaluation_notes: parsed.data.evaluation_notes ?? null,
      ...m,
    });

    revalidatePath("/performance");
    return { ok: true, id: row.id };
  } catch (e) {
    return fail(errMessage(e));
  }
}

export async function updateEvaluationAction(
  id: string,
  values: unknown,
): Promise<ActionResult> {
  const parsed = createEvaluationSchema.safeParse(values);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  try {
    const profile = await getCurrentProfile();
    if (!profile) return fail("Not authenticated.");
    const permissions = await getCurrentPermissions();
    if (!can("performance.evaluate", permissions))
      return fail("Not authorized.");

    const m = await computeEmployeeMetrics(
      parsed.data.employee_id,
      parsed.data.period,
    );
    await updateEvaluation(id, {
      employee_id: parsed.data.employee_id,
      period: parsed.data.period,
      evaluation_notes: parsed.data.evaluation_notes ?? null,
      ...m,
    });

    revalidatePath("/performance");
    return { ok: true, id };
  } catch (e) {
    return fail(errMessage(e));
  }
}
