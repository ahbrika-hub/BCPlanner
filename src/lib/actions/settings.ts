"use server";

import { revalidatePath } from "next/cache";

import { updateSettingsSchema } from "@/lib/validations";
import { getCurrentProfile, getCurrentPermissions } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { updateSetting } from "@/lib/data/settings";
import type { ActionResult } from "@/lib/actions/tasks";

export async function updateSettingsAction(
  values: unknown,
): Promise<ActionResult> {
  const parsed = updateSettingsSchema.safeParse(values);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }
  try {
    const profile = await getCurrentProfile();
    if (!profile) return { ok: false, error: "Not authenticated." };
    const permissions = await getCurrentPermissions();
    if (!can("settings.manage", permissions)) {
      return { ok: false, error: "Not authorized." };
    }

    for (const { key, value } of parsed.data.settings) {
      await updateSetting(key, value);
    }
    revalidatePath("/admin/settings");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}
