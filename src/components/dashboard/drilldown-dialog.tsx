"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";

import {
  fetchDrilldownTasks,
  type DrilldownKey,
  type DrilldownTask,
} from "@/lib/actions/dashboard-drilldown";
import { TaskTable } from "@/components/dashboard/task-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Drill-down popup listing the records behind a dashboard metric. Lazily loads
 * the rows (read-only, RLS-scoped) when opened; each row deep-links to the
 * task-detail modal, and an optional "Open in Tasks" link lands on the
 * pre-filtered list. Closes via the X, Esc, or a click outside (shadcn Dialog).
 */
export function DrilldownDialog({
  open,
  onOpenChange,
  title,
  description,
  drilldown,
  viewAllHref,
  showHours = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  drilldown: DrilldownKey;
  viewAllHref?: string;
  /** Show an estimated-hours column in the row list (workload drill-down). */
  showHours?: boolean;
}) {
  // Rows are tagged with the key they belong to, so a key change derives back to
  // "loading" without a synchronous setState in the effect.
  const [loaded, setLoaded] = useState<{
    key: string;
    rows: DrilldownTask[];
  } | null>(null);
  const [pending, startTransition] = useTransition();
  const keyStr = JSON.stringify(drilldown);

  useEffect(() => {
    if (!open) return;
    startTransition(async () => {
      const data = await fetchDrilldownTasks(drilldown);
      setLoaded({ key: keyStr, rows: data });
    });
    // drilldown is captured via its serialized key; refetch when it changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, keyStr]);

  const rows = loaded?.key === keyStr ? loaded.rows : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        {pending || rows === null ? (
          <div className="text-fg-muted flex items-center justify-center py-10">
            <Loader2 className="size-5 animate-spin" aria-label="Loading" />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            title="No records"
            description="Nothing matches this metric right now."
          />
        ) : (
          <TaskTable
            rows={rows}
            showDue
            showHours={showHours}
            onRowNavigate={() => onOpenChange(false)}
          />
        )}

        {viewAllHref && (
          <div className="flex justify-end border-t pt-3">
            <Button asChild size="sm" variant="outline">
              <Link href={viewAllHref} onClick={() => onOpenChange(false)}>
                Open in Tasks
              </Link>
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
