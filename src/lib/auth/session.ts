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

/** Permission keys granted to the given role (via role_permissions). */
export async function getCurrentPermissions(role: string): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("role_permissions")
    .select("permissions(key)")
    .eq("role", role as Database["public"]["Enums"]["user_role"]);

  if (!data) return [];

  return data
    .map((row) => {
      const p = row.permissions as { key: string } | { key: string }[] | null;
      if (!p) return null;
      return Array.isArray(p) ? (p[0]?.key ?? null) : p.key;
    })
    .filter((key): key is string => key !== null);
}
