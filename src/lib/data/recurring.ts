import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Tables } from "./types";

const SELECT = `
  *,
  assignee:profiles!recurring_tasks_assignee_id_fkey(id, full_name),
  business_line:business_lines!recurring_tasks_business_line_id_fkey(id, name)
`;

export type RecurringWithRelations = Tables["recurring_tasks"]["Row"] & {
  assignee: { id: string; full_name: string } | null;
  business_line: { id: string; name: string } | null;
};

export async function listRecurringTasks(): Promise<RecurringWithRelations[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recurring_tasks")
    .select(SELECT)
    .order("next_generation_date", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as RecurringWithRelations[];
}

export async function getRecurringTask(
  id: string,
): Promise<RecurringWithRelations | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("recurring_tasks")
    .select(SELECT)
    .eq("id", id)
    .maybeSingle();
  return (data as unknown as RecurringWithRelations) ?? null;
}

export async function createRecurringTask(
  input: Tables["recurring_tasks"]["Insert"],
): Promise<Tables["recurring_tasks"]["Row"]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recurring_tasks")
    .insert(input)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateRecurringTask(
  id: string,
  patch: Tables["recurring_tasks"]["Update"],
): Promise<Tables["recurring_tasks"]["Row"]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recurring_tasks")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteRecurringTask(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("recurring_tasks")
    .delete()
    .eq("id", id);
  if (error) throw new Error(error.message);
}

/** Runs the generation function; returns the number of tasks created. */
export async function generateDueTasks(): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("generate_due_recurring_tasks");
  if (error) throw new Error(error.message);
  return data ?? 0;
}
