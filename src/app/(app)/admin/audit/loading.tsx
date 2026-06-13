import { PageHeaderSkeleton, TableSkeleton } from "@/components/ui/skeletons";

export default function AuditLoading() {
  return (
    <>
      <PageHeaderSkeleton />
      <TableSkeleton rows={8} columns={6} />
    </>
  );
}
