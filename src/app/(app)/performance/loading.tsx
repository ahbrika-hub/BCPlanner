import { PageHeaderSkeleton, TableSkeleton } from "@/components/ui/skeletons";

export default function PerformanceLoading() {
  return (
    <>
      <PageHeaderSkeleton withAction />
      <TableSkeleton rows={6} columns={6} />
    </>
  );
}
