"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, AlertTriangle } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  buildCalendarMonth,
  monthLabel,
  addMonths,
  WEEKDAY_LABELS,
  type CalendarTask,
} from "@/lib/tasks/calendar";
import type { TaskWithRelations } from "@/lib/data/types";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

/**
 * Read-only planning calendar. Plots tasks on their `due_date` in a Sunday-first
 * month grid; clicking a task soft-navigates to `/tasks/[id]` (the existing modal
 * intercept opens it). Overdue tasks are marked with the canonical rule. Tasks
 * WITHOUT a due_date can't be placed on a day, so they are listed in a "No due
 * date" area beneath the grid (not dropped). This view performs NO writes — no
 * drag, no reschedule, no status change (deferred to a future PR).
 *
 * `todayStr` is computed once on the client; month navigation is local state and
 * never refetches (all visible tasks are already loaded, RLS-scoped, on the
 * server).
 */
export function PlanningCalendar({
  tasks,
  todayStr,
}: {
  tasks: TaskWithRelations[];
  todayStr: string;
}) {
  const [cursor, setCursor] = useState(() => {
    const [y, m] = todayStr.split("-");
    return { year: Number(y), month: Number(m) - 1 };
  });

  const { calendar, undated } = useMemo(
    () => buildCalendarMonth(cursor.year, cursor.month, tasks, todayStr),
    [cursor.year, cursor.month, tasks, todayStr],
  );

  const go = (delta: number) =>
    setCursor((c) => addMonths(c.year, c.month, delta));
  const goToday = () => {
    const [y, m] = todayStr.split("-");
    setCursor({ year: Number(y), month: Number(m) - 1 });
  };

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={() => go(-1)}
          aria-label="Previous month"
        >
          <ChevronLeft className="size-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={() => go(1)}
          aria-label="Next month"
        >
          <ChevronRight className="size-4" />
        </Button>
        <h2 className="ml-1 text-lg font-semibold">
          {monthLabel(calendar.year, calendar.month)}
        </h2>
        <Button variant="ghost" size="sm" onClick={goToday} className="ml-auto">
          Today
        </Button>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[44rem]">
          <div className="grid grid-cols-7 border-t border-l">
            {WEEKDAY_LABELS.map((label) => (
              <div
                key={label}
                className="text-muted-foreground border-r border-b px-2 py-1.5 text-center text-xs font-medium"
              >
                {label}
              </div>
            ))}
            {calendar.weeks.map((week) =>
              week.map((cell) => (
                <div
                  key={cell.date}
                  className={cn(
                    "min-h-28 border-r border-b p-1.5 align-top",
                    !cell.inMonth && "bg-muted/30",
                    cell.isToday && "bg-primary/5",
                  )}
                >
                  <div
                    className={cn(
                      "mb-1 text-right text-xs",
                      cell.inMonth
                        ? "text-foreground"
                        : "text-muted-foreground/60",
                      cell.isToday &&
                        "text-primary font-semibold",
                    )}
                  >
                    {cell.day}
                  </div>
                  <div className="flex flex-col gap-1">
                    {cell.tasks.map((task) => (
                      <CalendarChip key={task.id} task={task} />
                    ))}
                  </div>
                </div>
              )),
            )}
          </div>
        </div>
      </div>

      {undated.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-2 text-sm font-semibold">
            No due date{" "}
            <span className="text-muted-foreground font-normal">
              ({undated.length})
            </span>
          </h3>
          <p className="text-muted-foreground mb-2 text-xs">
            These tasks have no due date, so they can&apos;t be plotted on a day.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {undated.map((task) => (
              <CalendarChip key={task.id} task={task} />
            ))}
          </div>
        </div>
      )}

      {tasks.length === 0 && (
        <div className="mt-6">
          <EmptyState
            title="No tasks"
            description="Tasks you can see will appear on their due dates here."
          />
        </div>
      )}
    </div>
  );
}

function CalendarChip({ task }: { task: CalendarTask }) {
  return (
    <Link
      href={`/tasks/${task.id}`}
      title={`${task.task_no ?? ""} ${task.title}`}
      className={cn(
        "flex items-center gap-1 rounded border px-1.5 py-1 text-xs",
        "transition-colors motion-reduce:transition-none",
        "focus-visible:ring-ring/50 outline-none focus-visible:ring-2",
        task.overdue
          ? "border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/15"
          : "bg-background hover:bg-muted",
      )}
    >
      {task.overdue && (
        <AlertTriangle className="size-3 shrink-0" aria-hidden="true" />
      )}
      <span className="truncate">{task.title}</span>
    </Link>
  );
}
