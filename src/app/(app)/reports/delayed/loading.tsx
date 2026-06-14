import { Skeleton } from "@/components/ui/skeleton";
import {
  PageHeaderSkeleton,
  KpiCardSkeleton,
  ChartSkeleton,
  TableSkeleton,
} from "@/components/ui/skeletons";

// Delayed-tasks report fallback. Mirrors the loaded shape — header + actions,
// the filter row, four KPI cards, the breakdown charts, and the detail table.
export default function DelayedReportLoading() {
  return (
    <>
      <PageHeaderSkeleton withAction />
      {/* report filters (date range / business line / assignee) */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Skeleton className="h-9 w-36" />
        <Skeleton className="h-9 w-36" />
        <Skeleton className="h-9 w-44" />
        <Skeleton className="h-9 w-44" />
      </div>
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <KpiCardSkeleton key={i} />
        ))}
      </div>
      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <ChartSkeleton />
        <ChartSkeleton />
        <ChartSkeleton />
      </div>
      <TableSkeleton rows={8} columns={7} />
    </>
  );
}
