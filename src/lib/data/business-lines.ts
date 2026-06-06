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
