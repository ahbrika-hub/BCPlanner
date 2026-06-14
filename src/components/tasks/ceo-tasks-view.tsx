"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, BellRing } from "lucide-react";
import { toast } from "sonner";

import { requestTaskUpdateAction } from "@/lib/actions/tasks";
import type { CeoDepartmentTask } from "@/lib/data/tasks";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/**
 * CEO oversight Tasks view: ALL department tasks, NO assignee identity (the
 * data source omits it server-side). The CEO can nudge for an update only on
 * rows that are his own requests (is_my_request).
 */
export function CeoTasksView({ tasks }: { tasks: CeoDepartmentTask[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  const requestUpdate = (id: string) => {
    setBusyId(id);
    startTransition(async () => {
      const res = await requestTaskUpdateAction(id);
      setBusyId(null);
      if (res.ok) {
        toast.success("Update requested");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  };

  if (tasks.length === 0) {
    return (
      <EmptyState
        title="No tasks yet"
        description="Department tasks will appear here."
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Task</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Priority</TableHead>
            <TableHead>Business line</TableHead>
            <TableHead>Due</TableHead>
            <TableHead className="text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.map((t) => (
            <TableRow key={t.id}>
              <TableCell className="font-medium">
                <div className="flex items-center gap-2">
                  <span>{t.title}</span>
                  {t.is_my_request && (
                    <Badge variant="secondary">My request</Badge>
                  )}
                </div>
                <span className="text-muted-foreground text-xs">
                  {t.task_no}
                </span>
              </TableCell>
              <TableCell>
                <StatusBadge status={t.status} />
              </TableCell>
              <TableCell className="capitalize">{t.priority}</TableCell>
              <TableCell>{t.business_line ?? "—"}</TableCell>
              <TableCell>{t.due_date ? formatDate(t.due_date) : "—"}</TableCell>
              <TableCell className="text-right">
                {t.is_my_request ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending && busyId === t.id}
                    onClick={() => requestUpdate(t.id)}
                  >
                    {pending && busyId === t.id ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <BellRing className="size-4" />
                    )}
                    Request update
                  </Button>
                ) : (
                  <span className="text-muted-foreground text-xs">—</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
