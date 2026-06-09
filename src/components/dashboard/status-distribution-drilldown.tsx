"use client";

import { useState } from "react";

import {
  StatusDistributionChart,
  type StatusDatum,
} from "@/components/charts/status-distribution-chart";
import { DrilldownDialog } from "@/components/dashboard/drilldown-dialog";
import type { TaskStatus } from "@/lib/data/types";

const humanize = (s: string) =>
  s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

/**
 * Status donut wired for drill-down: clicking a segment opens a popup listing
 * the tasks in that status (with an "Open in Tasks" link to the filtered list).
 */
export function StatusDistributionDrilldown({ data }: { data: StatusDatum[] }) {
  const [status, setStatus] = useState<string | null>(null);

  return (
    <>
      <StatusDistributionChart data={data} onSegmentClick={setStatus} />
      <DrilldownDialog
        open={status !== null}
        onOpenChange={(o) => {
          if (!o) setStatus(null);
        }}
        title={status ? `${humanize(status)} tasks` : ""}
        description="Tasks currently in this status."
        // When closed (status null) the key is inert — the dialog won't fetch.
        drilldown={
          status
            ? { kind: "status", status: status as TaskStatus }
            : { kind: "active" }
        }
        viewAllHref={status ? `/tasks?status=${status}` : undefined}
      />
    </>
  );
}
