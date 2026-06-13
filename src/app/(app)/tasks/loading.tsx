import { PageHeaderSkeleton, TableSkeleton } from "@/components/ui/skeletons";

export default function TasksLoading() {
  return (
    <>
      <PageHeaderSkeleton withAction />
      <TableSkeleton rows={8} columns={6} />
    </>
  );
}
