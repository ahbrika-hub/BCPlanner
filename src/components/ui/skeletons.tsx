import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { TableCell, TableRow } from "@/components/ui/table";

/**
 * Loading skeletons matched to the Phase 1 primitives. Use these inside
 * Suspense fallbacks so the loading shape mirrors the loaded content.
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
