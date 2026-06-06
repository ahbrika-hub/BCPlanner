import { cn } from "@/lib/utils";
import type { Database } from "@/types/database.types";

type TaskStatus = Database["public"]["Enums"]["task_status"];

const labels: Record<TaskStatus, string> = {
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

/**
 * Status pill using the per-status design tokens
 * (var(--color-status-<status>)). Soft tinted background + colored text/border.
 */
export function StatusBadge({
  status,
  className,
}: {
  status: TaskStatus;
  className?: string;
}) {
  const color = `var(--color-status-${status})`;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        className,
      )}
      style={{
        color,
        borderColor: color,
        backgroundColor: `color-mix(in srgb, ${color} 10%, transparent)`,
      }}
    >
      {labels[status]}
    </span>
  );
}
