import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Tables } from "./types";

const SELECT = `
  *,
  business_line:business_lines!projects_business_line_id_fkey(id, name)
`;

export type ProjectWithBusinessLine = Tables["projects"]["Row"] & {
  business_line: { id: string; name: string } | null;
};

export async function listProjects(): Promise<ProjectWithBusinessLine[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .select(SELECT)
    .order("is_active", { ascending: false })
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as ProjectWithBusinessLine[];
}

/** Active projects only, for the task-form project selector (projects.read). */
export async function listActiveProjects(): Promise<
  { id: string; name: string }[]
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .select("id, name")
    .eq("is_active", true)
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

/**
 * True iff the project exists and is active. Used server-side when an edit
 * re-points a task at a project — a project can be deactivated after the task
 * was created, so the edit path verifies the target is still active rather than
 * trusting the client-supplied id.
 */
export async function isActiveProject(id: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("projects")
    .select("id")
    .eq("id", id)
    .eq("is_active", true)
    .maybeSingle();
  return data !== null;
}

export async function createProject(
  input: Tables["projects"]["Insert"],
): Promise<Tables["projects"]["Row"]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .insert(input)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateProject(
  id: string,
  patch: Tables["projects"]["Update"],
): Promise<Tables["projects"]["Row"]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}
