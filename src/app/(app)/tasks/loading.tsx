import { PageHeaderSkeleton, TableSkeleton } from "@/components/ui/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

// Task-list-specific skeleton: header + the two filter rows (search/status/
// overdue/priority and assignee/business-line) + the table.
export default function TasksLoading() {
  return (
    <>
      <PageHeaderSkeleton withAction />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-9 w-28" />
        <Skeleton className="h-9 w-36" />
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-9 w-48" />
      </div>
      <TableSkeleton rows={8} columns={6} />
    </>
  );
}
