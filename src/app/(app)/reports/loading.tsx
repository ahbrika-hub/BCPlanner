import {
  PageHeaderSkeleton,
  KpiCardSkeleton,
  ChartSkeleton,
  TableSkeleton,
} from "@/components/ui/skeletons";

// Mirrors the reports page shape: header + KPI row + three charts + table.
export default function ReportsLoading() {
  return (
    <>
      <PageHeaderSkeleton withAction />
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <KpiCardSkeleton key={i} />
        ))}
      </div>
      <div className="mb-6 grid gap-6 lg:grid-cols-3">
        <ChartSkeleton />
        <ChartSkeleton />
        <ChartSkeleton />
      </div>
      <TableSkeleton rows={6} columns={7} />
    </>
  );
}
