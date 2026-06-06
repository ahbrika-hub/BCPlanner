import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

/** The authenticated Supabase user (validated server-side), or null. */
export async function getCurrentUser() {
  const supabase = await createClient();
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user;
  } catch {
    return null;
  }
}

/** The current user's full profile row, or null if no session/profile. */
export async function getCurrentProfile(): Promise<Profile | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  return data ?? null;
}

/**
 * Permission keys granted to the current user, via the get_my_permissions()
 * SECURITY DEFINER function (bypasses role_permissions RLS, which only admins
 * can read). The role is derived from auth.uid() inside the function.
 */
export async function getCurrentPermissions(): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_my_permissions");
  return data ?? [];
}
