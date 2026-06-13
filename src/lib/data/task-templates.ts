import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Tables } from "./types";

const SELECT = `
  *,
  business_line:business_lines!task_templates_business_line_id_fkey(id, name)
`;

export type TaskTemplateRow = Tables["task_templates"]["Row"];

export type TaskTemplateWithBusinessLine = TaskTemplateRow & {
  business_line: { id: string; name: string } | null;
};

/** All templates (RLS: templates.read), active first then by name. */
export async function listTaskTemplates(): Promise<
  TaskTemplateWithBusinessLine[]
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("task_templates")
    .select(SELECT)
    .order("is_active", { ascending: false })
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as TaskTemplateWithBusinessLine[];
}

/** Active templates only, for the create-form selector (templates.read). */
export async function listActiveTaskTemplates(): Promise<
  TaskTemplateWithBusinessLine[]
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("task_templates")
    .select(SELECT)
    .eq("is_active", true)
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as TaskTemplateWithBusinessLine[];
}

export async function createTaskTemplate(
  input: Tables["task_templates"]["Insert"],
): Promise<TaskTemplateRow> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("task_templates")
    .insert(input)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateTaskTemplate(
  id: string,
  patch: Tables["task_templates"]["Update"],
): Promise<TaskTemplateRow> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("task_templates")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}
