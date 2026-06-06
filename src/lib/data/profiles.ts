import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { AssignableUser } from "./types";

/** Active employees and section heads, for the assignee dropdown. */
export async function listAssignableUsers(): Promise<AssignableUser[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, role")
    .eq("is_active", true)
    .in("role", ["employee", "section_head"])
    .order("full_name", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}
