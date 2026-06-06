import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Tables, UserRole } from "./types";

export type UserWithDepartment = Tables["profiles"]["Row"] & {
  department: { id: string; name: string } | null;
};

export type UserFilters = {
  role?: UserRole;
  department_id?: string;
  is_active?: boolean;
  search?: string;
};

export async function listUsers(
  filters: UserFilters = {},
): Promise<UserWithDepartment[]> {
  const supabase = await createClient();
  let q = supabase
    .from("profiles")
    .select("*, department:departments!profiles_department_id_fkey(id, name)")
    .order("full_name", { ascending: true });

  if (filters.role) q = q.eq("role", filters.role);
  if (filters.department_id) q = q.eq("department_id", filters.department_id);
  if (typeof filters.is_active === "boolean")
    q = q.eq("is_active", filters.is_active);
  if (filters.search)
    q = q.or(
      `full_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%`,
    );

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as UserWithDepartment[];
}

export async function getUser(id: string): Promise<UserWithDepartment | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("*, department:departments!profiles_department_id_fkey(id, name)")
    .eq("id", id)
    .maybeSingle();
  return (data as unknown as UserWithDepartment) ?? null;
}

export async function updateUser(
  id: string,
  patch: Tables["profiles"]["Update"],
): Promise<Tables["profiles"]["Row"]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

/** Count of active admins — used to block removing the last admin. */
export async function countActiveAdmins(): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "admin")
    .eq("is_active", true);
  return count ?? 0;
}
