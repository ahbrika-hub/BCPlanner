import { PageHeaderSkeleton, TableSkeleton } from "@/components/ui/skeletons";

export default function RecurringLoading() {
  return (
    <>
      <PageHeaderSkeleton withAction />
      <TableSkeleton rows={6} columns={5} />
    </>
  );
}
