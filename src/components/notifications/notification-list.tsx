"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  markNotificationReadAction,
  markAllNotificationsReadAction,
} from "@/lib/actions/notifications";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/format";
import type { NotificationRow } from "@/lib/data/types";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export function NotificationList({ items }: { items: NotificationRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const open = (n: NotificationRow) => {
    startTransition(async () => {
      if (!n.is_read) await markNotificationReadAction(n.id);
      if (n.task_id) router.push(`/tasks/${n.task_id}`);
      else router.refresh();
    });
  };

  const markAll = () => {
    startTransition(async () => {
      const res = await markAllNotificationsReadAction();
      if (res.ok) {
        toast.success("All marked read");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  };

  if (items.length === 0) {
    return (
      <EmptyState
        title="No notifications"
        description="You're all caught up."
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={markAll}
          disabled={pending}
        >
          Mark all read
        </Button>
      </div>
      <ul className="divide-y rounded-lg border">
        {items.map((n) => (
          <li key={n.id}>
            <button
              type="button"
              onClick={() => open(n)}
              disabled={pending}
              className={cn(
                "hover:bg-accent flex w-full items-start gap-3 p-3 text-left transition-colors",
                !n.is_read && "bg-accent/40",
              )}
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
                    className={cn("text-sm", !n.is_read && "font-semibold")}
                  >
                    {n.title}
                  </span>
                  <span className="text-muted-foreground shrink-0 text-xs">
                    {formatDateTime(n.created_at)}
                  </span>
                </span>
                {n.message && (
                  <span className="text-muted-foreground block truncate text-sm">
                    {n.message}
                  </span>
                )}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
