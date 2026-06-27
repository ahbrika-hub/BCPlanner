"use server";

import { revalidatePath } from "next/cache";

import { createHolidaySchema, updateHolidaySchema } from "@/lib/validations";
import { getCurrentProfile, getCurrentPermissions } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { createHoliday, updateHoliday, deleteHoliday } from "@/lib/data/holidays";
import type { ActionResult } from "@/lib/actions/tasks";

function fail(error: string): ActionResult {
  return { ok: false, error };
}
function errMessage(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong.";
}

// Holidays are reference/config data, gated by the EXISTING settings.manage
// permission (same key as business_lines / app_settings) — no new permission.
async function ensureManager(): Promise<ActionResult | null> {
  const profile = await getCurrentProfile();
  if (!profile) return fail("Not authenticated.");
  const permissions = await getCurrentPermissions();
  if (!can("settings.manage", permissions)) return fail("Not authorized.");
  return null;
}

function revalidate() {
  revalidatePath("/admin/holidays");
  revalidatePath("/workload"); // capacity depends on holidays
}

export async function createHolidayAction(
  values: unknown,
): Promise<ActionResult> {
  const parsed = createHolidaySchema.safeParse(values);
  if (!parsed.success)
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  const denied = await ensureManager();
  if (denied) return denied;
  try {
    const row = await createHoliday(parsed.data);
    revalidate();
    return { ok: true, id: row.id };
  } catch (e) {
    return fail(errMessage(e));
  }
}

export async function updateHolidayAction(
  values: unknown,
): Promise<ActionResult> {
  const parsed = updateHolidaySchema.safeParse(values);
  if (!parsed.success)
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  const denied = await ensureManager();
  if (denied) return denied;
  try {
    await updateHoliday(parsed.data.id, {
      holiday_date: parsed.data.holiday_date,
      name: parsed.data.name,
    });
    revalidate();
    return { ok: true, id: parsed.data.id };
  } catch (e) {
    return fail(errMessage(e));
  }
}

export async function deleteHolidayAction(id: string): Promise<ActionResult> {
  const denied = await ensureManager();
  if (denied) return denied;
  try {
    await deleteHoliday(id);
    revalidate();
    return { ok: true, id };
  } catch (e) {
    return fail(errMessage(e));
  }
}
