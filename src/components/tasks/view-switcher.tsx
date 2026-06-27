"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { LayoutGrid, ListTodo, CalendarDays } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Segmented control to switch between the three views of the SAME task data —
 * List (`/tasks`), Board (`/board`), and Calendar (`/calendar`). It carries the
 * current query string across so the shared filters (q / status / priority /
 * overdue / assignee / business_line / sort) survive the switch — the views all
 * read the same params, so there is no parallel filter state. The `view` param
 * (saved-view marker) is dropped when leaving the list.
 */
const VIEWS = [
  { href: "/tasks", label: "List", icon: ListTodo },
  { href: "/board", label: "Board", icon: LayoutGrid },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
] as const;

export function ViewSwitcher() {
  const pathname = usePathname();
  const params = useSearchParams();

  // Preserve the shared filters; drop `view` (only meaningful on the list).
  const next = new URLSearchParams(params.toString());
  next.delete("view");
  const qs = next.toString();

  return (
    <nav
      aria-label="Task view"
      className="bg-muted inline-flex items-center gap-1 rounded-lg p-1"
    >
      {VIEWS.map((v) => {
        const active = pathname === v.href;
        const Icon = v.icon;
        return (
          <Link
            key={v.href}
            href={qs ? `${v.href}?${qs}` : v.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-9 items-center gap-1.5 rounded-md px-3 text-sm font-medium",
              "transition-colors motion-reduce:transition-none",
              "focus-visible:ring-ring/50 outline-none focus-visible:ring-2",
              active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden="true" />
            {v.label}
          </Link>
        );
      })}
    </nav>
  );
}
