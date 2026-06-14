import { Skeleton } from "@/components/ui/skeleton";
import { PageHeaderSkeleton, TableSkeleton } from "@/components/ui/skeletons";

// Task-templates fallback. Mirrors the loaded shape — header, the "New template"
// action, and the templates table (Name / Default title / Business line /
// Status / Actions).
export default function TemplatesLoading() {
  return (
    <>
      <PageHeaderSkeleton />
      <div className="mb-4 flex justify-end">
        <Skeleton className="h-9 w-36 rounded-md" />
      </div>
      <TableSkeleton rows={6} columns={5} />
    </>
  );
}
