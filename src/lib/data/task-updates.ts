import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Tables, TaskUpdateWithUser } from "./types";

export async function listUpdates(
  taskId: string,
): Promise<TaskUpdateWithUser[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("task_updates")
    .select("*, updater:profiles!task_updates_updated_by_fkey(id, full_name)")
    .eq("task_id", taskId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as TaskUpdateWithUser[];
}

export async function addUpdate(
  input: Tables["task_updates"]["Insert"],
): Promise<Tables["task_updates"]["Row"]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("task_updates")
    .insert(input)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}
