"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import {
  getAssigneeWorkloadAction,
  type AssigneeWorkload,
} from "@/lib/actions/assignee-workload";
import { Badge } from "@/components/ui/badge";

const levelLabel: Record<string, string> = {
  low: "Low load",
  medium: "Medium load",
  high: "High load",
};
const levelVariant: Record<string, "secondary" | "default" | "destructive"> = {
  low: "secondary",
  medium: "default",
  high: "destructive",
};

/**
 * Read-only panel in the create-task dialog: once an assignee + start + due are
 * chosen, shows that employee's workload for [start, due] — assigned hours,
 * capacity, utilisation %, and a low/med/high indicator — to inform assignment.
 * Calls a server action that returns AGGREGATES ONLY (no other task details).
 */
export function AssigneeWorkloadPanel({
  assigneeId,
  from,
  to,
}: {
  assigneeId?: string;
  from?: string;
  to?: string;
}) {
  const [data, setData] = useState<AssigneeWorkload | null>(null);
  const [loading, setLoading] = useState(false);

  const ready = Boolean(assigneeId && from && to);

  useEffect(() => {
    // Not enough info yet — render() short-circuits on !ready, so no state reset
    // is needed here (avoids a synchronous setState inside the effect).
    if (!assigneeId || !from || !to) return;
    let cancelled = false;
    // debounce rapid field changes; all setState happens in the async callback.
    const handle = setTimeout(async () => {
      setLoading(true);
      const res = await getAssigneeWorkloadAction({ assigneeId, from, to });
      if (!cancelled) {
        setData(res);
        setLoading(false);
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [assigneeId, from, to]);

  if (!ready) {
    return (
      <div className="bg-muted/40 text-muted-foreground rounded-md border p-3 text-xs">
        Select an assignee, start and due date to preview their workload.
      </div>
    );
  }

  return (
    <div className="bg-muted/40 rounded-md border p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium">
          Assignee workload · {from} → {to}
        </span>
        {loading ? (
          <Loader2 className="text-muted-foreground size-4 animate-spin" />
        ) : (
          data && (
            <Badge variant={levelVariant[data.workload_level] ?? "secondary"}>
              {levelLabel[data.workload_level] ?? data.workload_level}
            </Badge>
          )
        )}
      </div>
      {data && !loading && (
        <>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
            <div>
              <dt className="text-muted-foreground">Assigned</dt>
              <dd className="font-medium">{data.total_estimated_hours}h</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Capacity</dt>
              <dd className="font-medium">{data.capacity_hours}h</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Utilisation</dt>
              <dd className="font-medium">
                {data.capacity_hours > 0 ? `${data.utilization_pct}%` : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Active tasks</dt>
              <dd className="font-medium">{data.active_task_count}</dd>
            </div>
          </dl>
          {data.capacity_hours === 0 && (
            <p className="text-muted-foreground mt-2 text-xs">
              No working days (Sun–Thu) in this span — Fri/Sat add no capacity.
            </p>
          )}
        </>
      )}
    </div>
  );
}
