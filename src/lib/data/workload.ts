import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { WorkloadRow } from "./types";

export async function getWorkload(
  filters: { search?: string } = {},
): Promise<WorkloadRow[]> {
  const supabase = await createClient();
  let query = supabase
    .from("daily_employee_workload")
    .select("*")
    .order("active_task_count", { ascending: false });

  if (filters.search) {
    query = query.ilike("full_name", `%${filters.search}%`);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as WorkloadRow[];
}
