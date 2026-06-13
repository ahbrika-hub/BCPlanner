import "server-only";

import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

/**
 * The authenticated Supabase user (validated server-side), or null.
 *
 * Wrapped in React `cache()` so repeated calls within a single request (the
 * (app) layout, nested pages, and Server Actions) share one round-trip. This is
 * request-scoped memoization only — it does not change what is returned.
 */
export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user;
  } catch {
    return null;
  }
});

/** The current user's full profile row, or null if no session/profile. */
export const getCurrentProfile = cache(async (): Promise<Profile | null> => {
  const user = await getCurrentUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  return data ?? null;
});

/**
 * Permission keys granted to the current user, via the get_my_permissions()
 * SECURITY DEFINER function (bypasses role_permissions RLS, which only admins
 * can read). The role is derived from auth.uid() inside the function.
 *
 * Request-scoped `cache()`: the layout and pages resolve permissions once.
 */
export const getCurrentPermissions = cache(async (): Promise<string[]> => {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_my_permissions");
  return data ?? [];
});
