"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCheck, Loader2, MailOpen, Mail, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  markNotificationReadAction,
  markAllNotificationsReadAction,
  markNotificationsRead,
  markNotificationsUnread,
  deleteNotifications,
} from "@/lib/actions/notifications";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/format";
import type { NotificationRow } from "@/lib/data/types";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/ui/empty-state";

export function NotificationList({ items }: { items: NotificationRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const allIds = useMemo(() => items.map((n) => n.id), [items]);
  const selectedIds = useMemo(
    () => allIds.filter((id) => selected.has(id)),
    [allIds, selected],
  );
  const allChecked: boolean | "indeterminate" =
    selectedIds.length === 0
      ? false
      : selectedIds.length === allIds.length
        ? true
        : "indeterminate";

  const toggle = (id: string, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const toggleAll = (on: boolean) =>
    setSelected(on ? new Set(allIds) : new Set());

  const open = (n: NotificationRow) => {
    startTransition(async () => {
      if (!n.is_read) await markNotificationReadAction(n.id);
      // Click-to-open: a soft navigation to the related task is intercepted by
      // the @modal slot and opens the task-detail modal (URL still /tasks/{id}
      // as a fallback). No related task → graceful refresh, no navigation.
      if (n.task_id) router.push(`/tasks/${n.task_id}`);
      else router.refresh();
    });
  };

  const runBulk = (
    action: (ids: string[]) => Promise<{ ok: boolean; error?: string }>,
    successMsg: string,
  ) => {
    const ids = selectedIds;
    if (ids.length === 0) return;
    startTransition(async () => {
      const res = await action(ids);
      if (res.ok) {
        toast.success(successMsg);
        setSelected(new Set());
        router.refresh();
      } else {
        toast.error(res.error ?? "Something went wrong.");
      }
    });
  };

  const onDelete = () => {
    if (selectedIds.length === 0) return;
    if (
      !window.confirm(
        `Delete ${selectedIds.length} notification${selectedIds.length > 1 ? "s" : ""}? This can't be undone.`,
      )
    )
      return;
    runBulk(
      deleteNotifications,
      `Deleted ${selectedIds.length} notification${selectedIds.length > 1 ? "s" : ""}`,
    );
  };

  const markAll = () =>
    startTransition(async () => {
      const res = await markAllNotificationsReadAction();
      if (res.ok) {
        toast.success("All marked read");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });

  if (items.length === 0) {
    return (
      <EmptyState
        title="No notifications"
        description="You're all caught up."
      />
    );
  }

  const hasSelection = selectedIds.length > 0;

  return (
    <div className="space-y-3">
      {/* Toolbar: select-all + bulk actions (when selecting) / mark-all-read. */}
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={allChecked}
            onCheckedChange={(v) => toggleAll(v === true)}
            aria-label="Select all notifications"
            disabled={pending}
          />
          {hasSelection ? `${selectedIds.length} selected` : "Select all"}
        </label>

        <div className="ms-auto flex items-center gap-2">
          {hasSelection ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => runBulk(markNotificationsRead, "Marked as read")}
                disabled={pending}
              >
                {pending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <MailOpen className="size-4" />
                )}
                Mark read
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  runBulk(markNotificationsUnread, "Marked as unread")
                }
                disabled={pending}
              >
                <Mail className="size-4" />
                Mark unread
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={onDelete}
                disabled={pending}
              >
                <Trash2 className="size-4" />
                Delete
              </Button>
            </>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={markAll}
              disabled={pending}
            >
              <CheckCheck className="size-4" />
              Mark all read
            </Button>
          )}
        </div>
      </div>

      <ul className="divide-border divide-y rounded-lg border">
        {items.map((n) => {
          const isSel = selected.has(n.id);
          return (
            <li
              key={n.id}
              className={cn(
                "flex items-start gap-3 p-3",
                !n.is_read && "bg-accent/40",
                isSel && "bg-primary/5",
              )}
            >
              <Checkbox
                className="mt-1"
                checked={isSel}
                onCheckedChange={(v) => toggle(n.id, v === true)}
                aria-label={`Select notification: ${n.title}`}
                disabled={pending}
              />
              <button
                type="button"
                onClick={() => open(n)}
                disabled={pending}
                className="hover:text-primary focus-visible:ring-ring/50 -m-1 flex min-w-0 flex-1 items-start gap-3 rounded p-1 text-left transition-colors outline-none focus-visible:ring-2 motion-reduce:transition-none"
              >
                <span
                  className={cn(
                    "mt-1.5 size-2 shrink-0 rounded-full",
                    n.is_read ? "bg-transparent" : "bg-primary",
                  )}
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span
                      className={cn(
                        "text-fg text-sm",
                        !n.is_read && "font-semibold",
                      )}
                    >
                      {n.title}
                    </span>
                    <span className="text-fg-muted shrink-0 text-xs">
                      {formatDateTime(n.created_at)}
                    </span>
                  </span>
                  {n.message && (
                    <span className="text-fg-muted block truncate text-sm">
                      {n.message}
                    </span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
