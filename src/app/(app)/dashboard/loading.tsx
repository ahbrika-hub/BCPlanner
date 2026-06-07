import { Skeleton } from "@/components/ui/skeleton";
import { KpiCardSkeleton, ChartSkeleton } from "@/components/ui/skeletons";

// Dashboard loading state. Shape mirrors the loaded variants (KPI row + charts)
// so the page doesn't jump on hydration. Role-agnostic — covers all three.
export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <div className="mb-2 space-y-2">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-56" />
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <KpiCardSkeleton key={i} />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <ChartSkeleton />
        <ChartSkeleton />
      </div>
    </div>
  );
}
