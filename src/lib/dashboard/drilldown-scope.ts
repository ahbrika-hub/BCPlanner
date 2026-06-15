import type { UserRole } from "@/lib/data/types";

export type DrilldownScope = "own" | "all" | "none";

/**
 * Single source of truth for the dashboard/metric drill-down trust boundary:
 *   • employee            → "own"  (only their own/assigned tasks)
 *   • section_head / admin → "all"  (any task — they hold tasks.read_all)
 *   • ceo                 → "none" (read-only executive overview; no task-detail
 *                                   drill-down even though they hold tasks.read_all)
 *
 * Reused by fetchDrilldownTasks (the server-side trust boundary) so every surface
 * — department dashboard, personal dashboard, project metrics — scopes the same
 * way. UI gates alone are bypassable, so this is enforced at the data layer.
 */
export function getDrilldownScope(role: UserRole): DrilldownScope {
  if (role === "ceo") return "none";
  if (role === "employee") return "own";
  return "all";
}
