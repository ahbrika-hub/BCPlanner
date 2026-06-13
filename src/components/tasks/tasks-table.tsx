"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { ArrowDown, ArrowUp, ChevronsUpDown, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatDate, priorityClasses, priorityLabels } from "@/lib/format";
import { isOverdue } from "@/lib/tasks/overdue";
import type { TaskWithRelations } from "@/lib/data/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type ColumnKey =
  | "task_no"
  | "title"
  | "status"
  | "priority"
  | "assignee"
  | "due_date";

type SortType = "text" | "date" | "priority";
type Direction = "asc" | "desc";

const COLUMNS: { key: ColumnKey; label: string; type: SortType }[] = [
  { key: "task_no", label: "Task No", type: "text" },
  { key: "title", label: "Title", type: "text" },
  { key: "status", label: "Status", type: "text" },
  { key: "priority", label: "Priority", type: "priority" },
  { key: "assignee", label: "Assignee", type: "text" },
  { key: "due_date", label: "Due", type: "date" },
];

const PRIORITY_RANK: Record<string, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

// Params that, when present, mean the user is actively filtering — used to pick
// the "no matches" empty state over the "no tasks yet" one.
const FILTER_PARAMS = [
  "q",
  "status",
  "overdue",
  "priority",
  "assignee",
  "business_line",
];

function textValue(t: TaskWithRelations, key: ColumnKey): string {
  switch (key) {
    case "task_no":
      return t.task_no ?? "";
    case "title":
      return t.title ?? "";
    case "status":
      return t.status ?? "";
    case "assignee":
      return t.assignee?.full_name ?? "";
    default:
      return "";
  }
}

function compare(
  a: TaskWithRelations,
  b: TaskWithRelations,
  key: ColumnKey,
  type: SortType,
): number {
  if (type === "date") {
    const av = a.due_date ? new Date(a.due_date).getTime() : null;
    const bv = b.due_date ? new Date(b.due_date).getTime() : null;
    if (av === null && bv === null) return 0;
    if (av === null) return 1;
    if (bv === null) return -1;
    return av - bv;
  }
  if (type === "priority") {
    return (PRIORITY_RANK[a.priority] ?? -1) - (PRIORITY_RANK[b.priority] ?? -1);
  }
  // Locale-aware, case-insensitive text sort.
  return textValue(a, key).localeCompare(textValue(b, key), undefined, {
    sensitivity: "base",
    numeric: true,
  });
}

/**
 * Client-side task table over the already-fetched (server- and RLS-filtered)
 * rows: Assignee + Business Line filters and column-header sorting (the PR #26
 * behavior), now persisted in the URL. These client filters update the address
 * bar via the History API — no extra server query or wider data exposure — so
 * state is shareable/reloadable without a refetch. An Overdue badge marks
 * overdue rows; two empty states distinguish "no tasks yet" from "no matches".
 */
export function TasksTable({ tasks }: { tasks: TaskWithRelations[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const assignee = params.get("assignee") ?? "all";
  const businessLine = params.get("business_line") ?? "all";

  const sort = useMemo<{ key: ColumnKey; dir: Direction } | null>(() => {
    const raw = params.get("sort");
    if (!raw) return null;
    const [key, dir] = raw.split(".");
    if (
      COLUMNS.some((c) => c.key === key) &&
      (dir === "asc" || dir === "desc")
    ) {
      return { key: key as ColumnKey, dir };
    }
    return null;
  }, [params]);

  // Update a client-side filter param without a server round-trip (History API);
  // useSearchParams stays in sync so the table re-renders instantly.
  const setClientParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(window.location.search);
    if (value && value !== "all") next.set(key, value);
    else next.delete(key);
    const qs = next.toString();
    window.history.replaceState(
      null,
      "",
      qs ? `${pathname}?${qs}` : pathname,
    );
  };

  // Filter options derived from the visible rows (so options never resolve to
  // an empty result set).
  const assigneeOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of tasks) {
      if (t.assignee_id && t.assignee?.full_name) {
        map.set(t.assignee_id, t.assignee.full_name);
      }
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [tasks]);

  const businessLineOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of tasks) {
      if (t.business_line_id && t.business_line?.name) {
        map.set(t.business_line_id, t.business_line.name);
      }
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [tasks]);

  const rows = useMemo(() => {
    let next = tasks;
    if (assignee !== "all") {
      next = next.filter((t) => t.assignee_id === assignee);
    }
    if (businessLine !== "all") {
      next = next.filter((t) => t.business_line_id === businessLine);
    }
    if (sort) {
      const col = COLUMNS.find((c) => c.key === sort.key);
      if (col) {
        next = [...next].sort((a, b) => {
          const r = compare(a, b, col.key, col.type);
          return sort.dir === "asc" ? r : -r;
        });
      }
    }
    return next;
  }, [tasks, assignee, businessLine, sort]);

  const toggleSort = (key: ColumnKey) => {
    const nextDir: Direction =
      sort?.key === key && sort.dir === "asc" ? "desc" : "asc";
    setClientParam("sort", `${key}.${nextDir}`);
  };

  const clearClientFilters = () => {
    const next = new URLSearchParams(window.location.search);
    next.delete("assignee");
    next.delete("business_line");
    const qs = next.toString();
    window.history.replaceState(null, "", qs ? `${pathname}?${qs}` : pathname);
  };

  const hasClientFilters = assignee !== "all" || businessLine !== "all";
  const anyFilterActive = FILTER_PARAMS.some((k) => params.get(k));

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Select
          value={assignee}
          onValueChange={(v) => setClientParam("assignee", v)}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Assignee" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All assignees</SelectItem>
            {assigneeOptions.map(([id, name]) => (
              <SelectItem key={id} value={id}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={businessLine}
          onValueChange={(v) => setClientParam("business_line", v)}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Business Line" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All business lines</SelectItem>
            {businessLineOptions.map(([id, name]) => (
              <SelectItem key={id} value={id}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasClientFilters && (
          <Button variant="ghost" size="sm" onClick={clearClientFilters}>
            <X className="size-4" />
            Clear
          </Button>
        )}
      </div>

      {rows.length === 0 ? (
        anyFilterActive ? (
          <EmptyState
            title="No tasks match"
            description="No tasks match these filters or search. Try clearing some."
            action={
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push(pathname)}
              >
                Clear all filters
              </Button>
            }
          />
        ) : (
          <EmptyState
            title="No tasks yet"
            description="Tasks you create or that are assigned to you will appear here."
          />
        )
      ) : (
        <div className="rounded-lg border">
          <Table stickyFirstColumn>
            <TableHeader>
              <TableRow>
                {COLUMNS.map((col) => {
                  const active = sort?.key === col.key;
                  const Icon = !active
                    ? ChevronsUpDown
                    : sort.dir === "asc"
                      ? ArrowUp
                      : ArrowDown;
                  return (
                    <TableHead
                      key={col.key}
                      aria-sort={
                        active
                          ? sort.dir === "asc"
                            ? "ascending"
                            : "descending"
                          : "none"
                      }
                    >
                      <button
                        type="button"
                        onClick={() => toggleSort(col.key)}
                        className="hover:text-foreground -mx-1 flex items-center gap-1 rounded px-1 outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                      >
                        {col.label}
                        <Icon
                          className={cn(
                            "size-3.5",
                            active
                              ? "text-foreground"
                              : "text-muted-foreground/50",
                          )}
                          aria-hidden="true"
                        />
                      </button>
                    </TableHead>
                  );
                })}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-mono text-xs">
                    <Link href={`/tasks/${t.id}`} className="hover:underline">
                      {t.task_no ?? "—"}
                    </Link>
                  </TableCell>
                  <TableCell className="font-medium">
                    <Link href={`/tasks/${t.id}`} className="hover:underline">
                      {t.title}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={t.status} />
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={priorityClasses[t.priority]}
                    >
                      {priorityLabels[t.priority]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {t.assignee?.full_name ?? "Unassigned"}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    <span className="flex items-center gap-2">
                      {formatDate(t.due_date)}
                      {isOverdue(t.due_date, t.status) && (
                        <Badge
                          variant="destructive"
                          className="bg-destructive text-white"
                        >
                          Overdue
                        </Badge>
                      )}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
