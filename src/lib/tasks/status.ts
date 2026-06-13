import type { TaskStatus } from "@/lib/data/types";

/** Canonical task statuses in lifecycle order (matches the `task_status` enum). */
export const TASK_STATUSES: readonly TaskStatus[] = [
  "draft",
  "pending_approval",
  "approved",
  "assigned",
  "in_progress",
  "pending_update",
  "pending_review",
  "completed",
  "rejected",
  "returned_for_modification",
  "cancelled",
  "reopened",
];

const STATUS_SET = new Set<string>(TASK_STATUSES);

/** Human label for a status (e.g. `returned_for_modification` → "Returned"). */
export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  draft: "Draft",
  pending_approval: "Pending Approval",
  approved: "Approved",
  assigned: "Assigned",
  in_progress: "In Progress",
  pending_update: "Pending Update",
  pending_review: "Pending Review",
  completed: "Completed",
  rejected: "Rejected",
  returned_for_modification: "Returned",
  cancelled: "Cancelled",
  reopened: "Reopened",
};

/** Narrow an arbitrary string to a valid TaskStatus (or undefined). */
export function asTaskStatus(value: string): TaskStatus | undefined {
  return STATUS_SET.has(value) ? (value as TaskStatus) : undefined;
}

/**
 * Parse a `status` search param (comma-separated and/or repeated) into a
 * de-duplicated list of valid statuses. Invalid tokens are dropped.
 */
export function parseStatusParam(
  raw: string | string[] | undefined,
): TaskStatus[] {
  if (!raw) return [];
  const tokens = (Array.isArray(raw) ? raw : [raw]).flatMap((v) =>
    v.split(","),
  );
  const out: TaskStatus[] = [];
  for (const token of tokens) {
    const s = asTaskStatus(token.trim());
    if (s && !out.includes(s)) out.push(s);
  }
  return out;
}
