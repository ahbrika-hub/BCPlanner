import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/**
 * Loading skeletons matched to the Phase 1 primitives. Use these inside
 * Suspense fallbacks and route `loading.tsx` files so the loading shape mirrors
 * the loaded content.
 */

/** A single table-row skeleton. Render N inside a <TableBody>. */
export function TableRowSkeleton({ columns = 5 }: { columns?: number }) {
  return (
    <TableRow>
      {Array.from({ length: columns }).map((_, i) => (
        <TableCell key={i}>
          <Skeleton
            className={cn("h-4", i === 0 ? "w-24" : "w-full max-w-[8rem]")}
          />
        </TableCell>
      ))}
    </TableRow>
  );
}

/** Page heading placeholder (title + subtitle, optional right-aligned action). */
export function PageHeaderSkeleton({
  withAction = false,
}: {
  withAction?: boolean;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-2">
        <Skeleton className="h-7 w-44" />
        <Skeleton className="h-4 w-60" />
      </div>
      {withAction && <Skeleton className="h-9 w-32 shrink-0 rounded-md" />}
    </div>
  );
}

/** Bordered table placeholder using the real table primitives. */
export function TableSkeleton({
  rows = 6,
  columns = 5,
}: {
  rows?: number;
  columns?: number;
}) {
  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            {Array.from({ length: columns }).map((_, i) => (
              <TableHead key={i}>
                <Skeleton className="h-4 w-20" />
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: rows }).map((_, r) => (
            <TableRowSkeleton key={r} columns={columns} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/** Stacked list placeholder (e.g. notifications). */
export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="divide-border divide-y rounded-lg border">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-4">
          <Skeleton className="size-4 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Matches the KpiCard anatomy (icon chip + label + big number). */
export function KpiCardSkeleton() {
  return (
    <Card className="gap-0 py-0">
      <CardContent className="flex items-start gap-4 p-5">
        <Skeleton className="size-10 shrink-0 rounded-md" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-7 w-16" />
        </div>
      </CardContent>
    </Card>
  );
}

/** A chart placeholder with faux axis baseline. */
export function ChartSkeleton({ className }: { className?: string }) {
  return (
    <Card className={cn("py-0", className)}>
      <CardContent className="p-5">
        <Skeleton className="mb-4 h-4 w-32" />
        <Skeleton className="h-48 w-full rounded-md" />
      </CardContent>
    </Card>
  );
}
