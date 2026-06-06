import type { Database } from "@/types/database.types";
import { TokenPill } from "@/components/ui/token-pill";

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
 * StatusBadge — task status indicator. Shares the {@link TokenPill} anatomy
 * (tinted background + 6px dot + label) and is fed by the per-status design
 * tokens (`var(--color-status-<status>)`), harmonized by lifecycle family.
 */
export function StatusBadge({
  status,
  className,
}: {
  status: TaskStatus;
  className?: string;
}) {
  return (
    <TokenPill
      color={`var(--color-status-${status})`}
      label={labels[status]}
      className={className}
    />
  );
}
