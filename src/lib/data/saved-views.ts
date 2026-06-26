import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Tables } from "./types";
import type { SavedViewConfig } from "@/lib/tasks/saved-view-config";

export type SavedViewRow = Tables["saved_views"]["Row"];

/**
 * A saved view with its config narrowed to the SavedViewConfig shape. The DB
 * column is `jsonb` (typed `Json`); rows are written only through the validated
 * action, so the stored value conforms — the cast surfaces that to callers.
 */
export type SavedView = Omit<SavedViewRow, "config"> & {
  config: SavedViewConfig;
};

/**
 * The caller's own saved views (owner-scoped by RLS), oldest first so the
 * sidebar order is stable as views are added.
 */
export async function listSavedViews(): Promise<SavedView[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("saved_views")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as SavedView[];
}

export async function createSavedView(
  input: Tables["saved_views"]["Insert"],
): Promise<SavedViewRow> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("saved_views")
    .insert(input)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateSavedView(
  id: string,
  patch: Tables["saved_views"]["Update"],
): Promise<SavedViewRow> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("saved_views")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteSavedView(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("saved_views").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
