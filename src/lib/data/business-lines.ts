import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { BusinessLineRow } from "./types";

export async function listBusinessLines(): Promise<BusinessLineRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("business_lines")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

/**
 * Id of the catch-all "General" business line, used as the default for a CEO
 * lightweight task request (the column is nullable, so a miss is non-fatal).
 */
export async function getGeneralBusinessLineId(): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("business_lines")
    .select("id")
    .eq("name", "General")
    .maybeSingle();
  return data?.id ?? null;
}
