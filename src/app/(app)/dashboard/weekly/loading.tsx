import { Skeleton } from "@/components/ui/skeleton";
import { KpiCardSkeleton, ChartSkeleton } from "@/components/ui/skeletons";

// Weekly (Business Lines) dashboard fallback. Mirrors the loaded shape — header,
// the business-line / period selector bar, a KPI tile row, two charts, and a
// scorecard table — so content swaps in without a layout jump.
export default function WeeklyDashboardLoading() {
  return (
    <div className="space-y-6">
      <div className="mb-2 space-y-2">
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-4 w-48" />
      </div>
      {/* business-line tabs + period switch */}
      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-9 w-28" />
        <Skeleton className="h-9 w-28" />
        <Skeleton className="h-9 w-28" />
        <Skeleton className="ms-auto h-9 w-44" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <KpiCardSkeleton key={i} />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <ChartSkeleton />
        <ChartSkeleton />
      </div>
      <ChartSkeleton className="h-64" />
    </div>
  );
}
