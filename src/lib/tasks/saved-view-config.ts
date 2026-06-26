import { z } from "zod";

import { TASK_STATUSES, asTaskStatus } from "@/lib/tasks/status";
import type { TaskStatus } from "@/lib/data/types";

/**
 * The snapshot of task-list filter + sort state that a Saved View persists. The
 * shape mirrors the EXISTING `/tasks` URL params exactly (see task-filters.tsx /
 * tasks-table.tsx) so a view round-trips through the same query string the list
 * already reads — there is no parallel filtering path. Values are stored in the
 * same string forms they take in the URL.
 *
 * URL param contract:
 *   q             free-text search           (server filter)
 *   status        comma-separated TaskStatus (server filter)  → string[] here
 *   priority      low|medium|high|critical   (server filter)
 *   overdue       "1" when on                (server filter)  → boolean here
 *   assignee      assignee UUID              (client filter)
 *   business_line business-line UUID         (client filter)
 *   sort          "<col>.<dir>"              (client filter)
 */

const SORT_RE = /^(task_no|title|status|priority|assignee|due_date)\.(asc|desc)$/;

// Tuple form so z.enum infers the literal union (TASK_STATUSES is readonly).
const STATUS_VALUES = TASK_STATUSES as readonly [TaskStatus, ...TaskStatus[]];

/**
 * Strict so an unknown key (e.g. a stray `view` param or a hand-crafted payload)
 * is rejected at the action layer rather than silently stored.
 */
export const savedViewConfigSchema = z
  .object({
    q: z.string().trim().max(200).optional(),
    status: z.array(z.enum(STATUS_VALUES)).optional(),
    priority: z.enum(["low", "medium", "high", "critical"]).optional(),
    overdue: z.boolean().optional(),
    assignee: z.uuid().optional(),
    business_line: z.uuid().optional(),
    sort: z.string().regex(SORT_RE).optional(),
  })
  .strict();

export type SavedViewConfig = z.infer<typeof savedViewConfigSchema>;

// Params that belong to the saved-view config (everything else in the URL, e.g.
// `view`, is ignored on read and never written into a config).
const CONFIG_PARAM_KEYS = [
  "q",
  "status",
  "priority",
  "overdue",
  "assignee",
  "business_line",
  "sort",
] as const;

/**
 * Read the current task-list URL state into a normalized config. Mirrors the
 * read paths in TaskFilters / TasksTable: comma-split + validated statuses,
 * overdue === "1", `all`/empty dropped. Unknown params are ignored.
 */
export function searchParamsToConfig(
  params: URLSearchParams,
): SavedViewConfig {
  const config: SavedViewConfig = {};

  const q = params.get("q")?.trim();
  if (q) config.q = q;

  const statuses = (params.get("status") ?? "")
    .split(",")
    .map((s) => asTaskStatus(s.trim()))
    .filter((s): s is TaskStatus => Boolean(s));
  if (statuses.length > 0) config.status = [...new Set(statuses)];

  const priority = params.get("priority");
  if (priority && priority !== "all") {
    const parsed = z
      .enum(["low", "medium", "high", "critical"])
      .safeParse(priority);
    if (parsed.success) config.priority = parsed.data;
  }

  if (params.get("overdue") === "1") config.overdue = true;

  const assignee = params.get("assignee");
  if (assignee && assignee !== "all") config.assignee = assignee;

  const businessLine = params.get("business_line");
  if (businessLine && businessLine !== "all") config.business_line = businessLine;

  const sort = params.get("sort");
  if (sort && SORT_RE.test(sort)) config.sort = sort;

  return config;
}

/**
 * Serialize a stored config back into the SAME URL param formats the task list
 * reads, so applying a view just sets the query string (the existing filtering
 * does the work). Returns the query string WITHOUT a leading "?". Empty config
 * → empty string. The output param order is stable (CONFIG_PARAM_KEYS).
 */
export function configToQueryString(config: unknown): string {
  const parsed = savedViewConfigSchema.safeParse(config);
  if (!parsed.success) return "";
  const c = parsed.data;
  const params = new URLSearchParams();

  for (const key of CONFIG_PARAM_KEYS) {
    switch (key) {
      case "status":
        if (c.status && c.status.length > 0)
          params.set("status", c.status.join(","));
        break;
      case "overdue":
        if (c.overdue) params.set("overdue", "1");
        break;
      default: {
        const value = c[key];
        if (typeof value === "string" && value.length > 0)
          params.set(key, value);
      }
    }
  }

  return params.toString();
}
