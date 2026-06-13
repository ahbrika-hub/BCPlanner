import { PageHeaderSkeleton, TableSkeleton } from "@/components/ui/skeletons";

export default function ProjectsLoading() {
  return (
    <>
      <PageHeaderSkeleton withAction />
      <TableSkeleton rows={6} columns={5} />
    </>
  );
}
