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

/**
 * The latest LIVE weekly snapshot (validated), or null if none/invalid.
 *
 * LIVE = the linked "Dashboard Update" task is completed (accepted by
 * section_head/admin) OR there is no linked task (admin seed / sample data →
 * always live). The live-check runs in the `get_latest_live_snapshot` SECURITY
 * DEFINER function so it is NOT filtered by the viewer's task RLS — every
 * dashboard.read viewer (incl. ceo/employee) sees the accepted snapshot. The
 * function still gates on the caller's dashboard.read.
 */
export async function getLatestSnapshot(): Promise<WeeklySnapshot> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_latest_live_snapshot");
  const row = Array.isArray(data) ? data[0] : null;
  if (!row) return null;
  const parsed = dashboardDataSchema.safeParse(row.data);
  if (!parsed.success) return null;
  return {
    weekStart: row.week_start,
    createdAt: row.created_at,
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
