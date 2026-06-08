"use server";

import { revalidatePath } from "next/cache";

import { updateUserSchema } from "@/lib/validations";
import { approveSignupSchema } from "@/lib/validations/auth";
import { getCurrentProfile, getCurrentPermissions } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { getUser, updateUser, countActiveAdmins } from "@/lib/data/users";
import type { ActionResult } from "@/lib/actions/tasks";

function fail(error: string): ActionResult {
  return { ok: false, error };
}

const DASHBOARD_INVITE_MESSAGE =
  "Invites are issued from the Supabase Dashboard (Authentication → Invite User). " +
  "The new user appears here as an employee; set their role and department from this screen.";

/**
 * Invites a brand-new auth user. The Supabase Admin API needs a server-side
 * service-role key (rotation pending — Phase 7). If the key isn't configured,
 * we return clear guidance for the Dashboard flow instead. No key is hardcoded.
 */
export async function inviteUserAction(email: string): Promise<ActionResult> {
  try {
    const actor = await getCurrentProfile();
    if (!actor) return fail("Not authenticated.");
    const permissions = await getCurrentPermissions();
    if (!can("users.invite", permissions)) return fail("Not authorized.");

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!serviceKey || !url) {
      return fail(DASHBOARD_INVITE_MESSAGE);
    }

    const { createClient: createAdminClient } =
      await import("@supabase/supabase-js");
    const admin = createAdminClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { error } = await admin.auth.admin.inviteUserByEmail(email);
    if (error) return fail(error.message);
    revalidatePath("/admin/users");
    return { ok: true };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Something went wrong.");
  }
}

/**
 * Approve a pending self-registration: activate the account and assign role +
 * department. Gated on the narrow `signups.approve` permission (admin +
 * section_head), distinct from full user CRUD (users.manage). The DB guard
 * (guard_profile_privileges) enforces the same on the row update.
 */
export async function approveSignupAction(
  id: string,
  values: unknown,
): Promise<ActionResult> {
  const parsed = approveSignupSchema.safeParse(values);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  try {
    const actor = await getCurrentProfile();
    if (!actor) return fail("Not authenticated.");
    const permissions = await getCurrentPermissions();
    if (!can("signups.approve", permissions)) return fail("Not authorized.");

    const target = await getUser(id);
    if (!target) return fail("User not found.");
    if (target.account_status !== "pending") {
      return fail("This account is not pending approval.");
    }

    await updateUser(id, {
      role: parsed.data.role,
      department_id: parsed.data.department_id ?? null,
      account_status: "active",
      is_active: true,
    });
    revalidatePath("/admin/users");
    return { ok: true, id };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Something went wrong.");
  }
}

export async function updateUserAction(
  id: string,
  values: unknown,
): Promise<ActionResult> {
  const parsed = updateUserSchema.safeParse(values);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  try {
    const actor = await getCurrentProfile();
    if (!actor) return fail("Not authenticated.");
    const permissions = await getCurrentPermissions();
    if (!can("users.manage", permissions)) return fail("Not authorized.");

    const target = await getUser(id);
    if (!target) return fail("User not found.");

    const patch = parsed.data;

    // Last-admin guardrail: block demoting/deactivating the final active admin.
    const demotingAdmin =
      target.role === "admin" &&
      target.is_active &&
      ((patch.role !== undefined && patch.role !== "admin") ||
        patch.is_active === false);
    if (demotingAdmin && (await countActiveAdmins()) <= 1) {
      return fail("Cannot demote or deactivate the last active admin.");
    }

    await updateUser(id, patch);
    revalidatePath("/admin/users");
    return { ok: true, id };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Something went wrong.");
  }
}
