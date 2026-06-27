"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";
import type { WorkloadRow } from "@/lib/data/types";
import { UTILIZATION_BAND } from "@/lib/workload/compute";
import { Progress } from "@/components/ui/progress";
import { TokenPill } from "@/components/ui/token-pill";
import { DrilldownDialog } from "@/components/dashboard/drilldown-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// Utilization band → semantic state token (hours-vs-capacity; see
// UTILIZATION_BAND). Color is paired with a text label (never color-only) for
// accessibility.
const levelColor: Record<string, string> = {
  high: "var(--color-danger)",
  medium: "var(--color-warning)",
  low: "var(--color-success)",
};
const levelLabel: Record<string, string> = {
  high: "Over capacity",
  medium: "Near capacity",
  low: "Under capacity",
};

/**
 * Workload table whose employee rows open a drill-down popup: the active tasks
 * behind that person's load (hours, status, due), via the reused
 * {@link DrilldownDialog} + read-only `assignee-active` drill-down (RLS-scoped).
 * Each task row deep-links to the task-detail modal. Closes via X / Esc / click
 * outside.
 */
export function WorkloadTable({ rows }: { rows: WorkloadRow[] }) {
  const [selected, setSelected] = useState<WorkloadRow | null>(null);

  const open = (r: WorkloadRow) => {
    if (r.employee_id) setSelected(r);
  };

  const level = selected?.workload_level ?? "low";

  return (
    <>
      {/* Band legend (cutoffs stated; color is paired with a label). */}
      <div className="text-muted-foreground mb-3 flex flex-wrap items-center gap-3 text-xs">
        <span>Utilization band:</span>
        <span className="inline-flex items-center gap-1">
          <span
            className="size-2.5 rounded-full"
            style={{ background: levelColor.low }}
            aria-hidden="true"
          />
          Under capacity (&lt;{UTILIZATION_BAND.near}%)
        </span>
        <span className="inline-flex items-center gap-1">
          <span
            className="size-2.5 rounded-full"
            style={{ background: levelColor.medium }}
            aria-hidden="true"
          />
          Near capacity ({UTILIZATION_BAND.near}–{UTILIZATION_BAND.over}%)
        </span>
        <span className="inline-flex items-center gap-1">
          <span
            className="size-2.5 rounded-full"
            style={{ background: levelColor.high }}
            aria-hidden="true"
          />
          Over capacity (&gt;{UTILIZATION_BAND.over}%)
        </span>
      </div>
      <div className="rounded-lg border">
        <Table stickyFirstColumn>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Active Tasks</TableHead>
              <TableHead>Est. Hours</TableHead>
              <TableHead className="w-48">Utilization</TableHead>
              <TableHead>Level</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => {
              const util = Number(r.utilization_pct ?? 0);
              const lvl = r.workload_level ?? "low";
              const clickable = !!r.employee_id;
              return (
                <TableRow
                  key={r.employee_id ?? r.full_name}
                  className={cn(clickable && "hover:bg-muted/50 cursor-pointer")}
                  onClick={clickable ? () => open(r) : undefined}
                >
                  <TableCell
                    className="font-medium"
                    style={{
                      boxShadow: `inset 4px 0 0 0 ${levelColor[lvl] ?? "transparent"}`,
                    }}
                  >
                    {clickable ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          open(r);
                        }}
                        aria-haspopup="dialog"
                        aria-label={`${r.full_name}: view workload breakdown`}
                        className="hover:text-primary focus-visible:ring-ring/50 rounded text-left hover:underline outline-none focus-visible:ring-2"
                      >
                        {r.full_name}
                      </button>
                    ) : (
                      r.full_name
                    )}
                  </TableCell>
                  <TableCell>{r.active_task_count}</TableCell>
                  <TableCell>{Number(r.total_estimated_hours ?? 0)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Progress value={Math.min(util, 100)} className="w-28" />
                      <span className="text-muted-foreground text-xs">
                        {util}%
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <TokenPill
                      color={
                        levelColor[lvl] ?? "var(--color-muted-foreground)"
                      }
                      label={levelLabel[lvl] ?? lvl}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <DrilldownDialog
        open={selected !== null}
        onOpenChange={(o) => {
          if (!o) setSelected(null);
        }}
        title={selected?.full_name ?? "Workload"}
        description={
          selected
            ? `${levelLabel[level] ?? level} load · ${selected.active_task_count ?? 0} active tasks · ${Number(selected.total_estimated_hours ?? 0)}h est.`
            : undefined
        }
        drilldown={{
          kind: "assignee-active",
          assigneeId: selected?.employee_id ?? "",
        }}
        showHours
      />
    </>
  );
}
