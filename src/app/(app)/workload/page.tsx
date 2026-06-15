import { getWorkloadForRange } from "@/lib/data/workload";
import { getCurrentProfile, getCurrentPermissions } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { todayDateString } from "@/lib/tasks/overdue";
import {
  resolveWorkloadRange,
  capacityHours,
  type WorkloadPreset,
} from "@/lib/workload/compute";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { WorkloadTable } from "@/components/workload/workload-table";
import { WorkloadPeriodFilter } from "@/components/workload/workload-period-filter";

const PRESETS = new Set<WorkloadPreset>(["today", "week", "month", "custom"]);

export default async function WorkloadPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [sp, profile] = await Promise.all([searchParams, getCurrentProfile()]);
  const permissions = profile ? await getCurrentPermissions() : [];

  if (
    !profile ||
    (!can("workload.read", permissions) &&
      !can("workload.read_all", permissions))
  ) {
    return (
      <>
        <PageHeader title="Workload" />
        <EmptyState
          title="Access restricted"
          description="You don't have permission to view workload."
        />
      </>
    );
  }

  const str = (v: string | string[] | undefined) =>
    typeof v === "string" && v ? v : undefined;
  const presetParam = str(sp.period);
  const preset: WorkloadPreset =
    presetParam && PRESETS.has(presetParam as WorkloadPreset)
      ? (presetParam as WorkloadPreset)
      : "week";

  const range = resolveWorkloadRange(
    preset,
    todayDateString(),
    str(sp.from),
    str(sp.to),
  );
  const capacity = capacityHours(range.from, range.to);

  const rows = await getWorkloadForRange({ from: range.from, to: range.to });

  const rangeLabel =
    range.from === range.to ? range.from : `${range.from} → ${range.to}`;

  return (
    <>
      <PageHeader
        title="Workload"
        subtitle={`Active capacity and utilization · ${rangeLabel} · ${
          capacity > 0
            ? `${capacity}h capacity / employee`
            : "no working days in range (Fri/Sat)"
        }`}
      />

      <WorkloadPeriodFilter
        preset={range.preset}
        from={range.from}
        to={range.to}
      />

      {rows.length === 0 ? (
        <EmptyState
          title="No workload data"
          description="No active tasks overlap the selected period."
        />
      ) : (
        <WorkloadTable rows={rows} />
      )}
    </>
  );
}
