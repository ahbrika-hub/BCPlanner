"use client";

import { useState } from "react";
import dynamic from "next/dynamic";

import type { StatusDatum } from "@/components/charts/status-distribution-chart";
import { DrilldownDialog } from "@/components/dashboard/drilldown-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import type { TaskStatus } from "@/lib/data/types";

// Lazy-load the Recharts donut (ssr:false) so Recharts is code-split out of the
// dashboard's initial bundle; the skeleton matches the donut's square footprint.
const StatusDistributionChart = dynamic(
  () =>
    import("@/components/charts/status-distribution-chart").then(
      (m) => m.StatusDistributionChart,
    ),
  {
    ssr: false,
    loading: () => (
      <Skeleton className="mx-auto aspect-square max-h-72 w-full rounded-md" />
    ),
  },
);

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
