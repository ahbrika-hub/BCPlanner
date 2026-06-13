import { PageHeaderSkeleton, TableSkeleton } from "@/components/ui/skeletons";

export default function WorkloadLoading() {
  return (
    <>
      <PageHeaderSkeleton />
      <TableSkeleton rows={6} columns={5} />
    </>
  );
}
