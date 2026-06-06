import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Tables } from "./types";

export async function listSettings(): Promise<Tables["app_settings"]["Row"][]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("app_settings")
    .select("*")
    .order("key", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function updateSetting(key: string, value: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("app_settings")
    .update({ value })
    .eq("key", key);
  if (error) throw new Error(error.message);
}
