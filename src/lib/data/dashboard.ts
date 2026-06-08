import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  dashboardDataSchema,
  type DashboardData,
} from "@/lib/validations/dashboard";

export type WeeklySnapshot = {
  weekStart: string;
  createdAt: string;
  data: DashboardData;
} | null;

/** The most recent weekly snapshot (validated), or null if none/invalid. */
export async function getLatestSnapshot(): Promise<WeeklySnapshot> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("dashboard_snapshots")
    .select("week_start, created_at, data")
    .order("week_start", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const parsed = dashboardDataSchema.safeParse(data.data);
  if (!parsed.success) return null;
  return {
    weekStart: data.week_start,
    createdAt: data.created_at,
    data: parsed.data,
  };
}

/** Optional per-business-line logo overrides, keyed by business-line name. */
export async function getBusinessLineLogos(): Promise<Record<string, string>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("business_lines")
    .select("name, logo_url");
  const map: Record<string, string> = {};
  for (const r of data ?? []) if (r.logo_url) map[r.name] = r.logo_url;
  return map;
}
