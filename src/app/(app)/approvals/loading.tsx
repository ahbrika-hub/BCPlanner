import { PageHeaderSkeleton, TableSkeleton } from "@/components/ui/skeletons";

export default function ApprovalsLoading() {
  return (
    <>
      <PageHeaderSkeleton />
      <TableSkeleton rows={6} columns={5} />
    </>
  );
}
