import type { Database } from "@/types/database.types";
import { TokenPill } from "@/components/ui/token-pill";

type TaskPriority = Database["public"]["Enums"]["task_priority"];

const labels: Record<TaskPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

/**
 * PriorityPill — task priority indicator. Same {@link TokenPill} anatomy as
 * {@link StatusBadge}, fed by the priority tokens (`var(--color-priority-*)`)
 * which follow a cool→warm escalation (slate → blue → amber → red).
 */
export function PriorityPill({
  priority,
  className,
}: {
  priority: TaskPriority;
  className?: string;
}) {
  return (
    <TokenPill
      color={`var(--color-priority-${priority})`}
      label={labels[priority]}
      className={className}
    />
  );
}
