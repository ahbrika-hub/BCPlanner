import { Skeleton } from "@/components/ui/skeleton";
import { PageHeaderSkeleton, KpiCardSkeleton } from "@/components/ui/skeletons";

// Project-health fallback. Mirrors the loaded shape — header (name + status
// badge), the six-up rollup KPI grid, and the average-progress card.
export default function ProjectHealthLoading() {
  return (
    <>
      <PageHeaderSkeleton withAction />
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <KpiCardSkeleton key={i} />
        ))}
      </div>
      <div className="bg-card space-y-3 rounded-xl border p-6">
        <Skeleton className="h-4 w-40" />
        <div className="flex items-baseline justify-between">
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-3 w-32" />
        </div>
        <Skeleton className="h-2 w-full rounded-full" />
      </div>
    </>
  );
}
