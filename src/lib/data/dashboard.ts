import "server-only";

import { createClient } from "@/lib/supabase/server";
import { DASHBOARD_UPLOAD_CATEGORY } from "@/lib/dashboard/constants";
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

/**
 * True when a Dashboard Update task is currently open (not completed/cancelled/
 * rejected). Drives the "Update in progress" button state. RLS-scoped, but the
 * request-update roles (admin/section_head/ceo) all hold tasks.read_all, so they
 * see the open task; the definer function is the authoritative de-dup.
 */
export async function hasOpenDashboardUpdate(): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tasks")
    .select("id")
    .eq("category", DASHBOARD_UPLOAD_CATEGORY)
    .not("status", "in", "(completed,cancelled,rejected)")
    .limit(1)
    .maybeSingle();
  return data !== null;
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
