"use client";

import { useMemo } from "react";
import Link from "next/link";
import { AlertTriangle, Link2, CircleDot } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  buildGantt,
  type GanttInputTask,
  type GanttInputDependency,
} from "@/lib/tasks/gantt";
import { formatDate } from "@/lib/format";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";

const HEADER_H = 28;
const BAR_PAD = 6;
const LABEL_W = 176; // w-44

/**
 * Read-only per-project Gantt/timeline. Renders each scheduled task as a bar on
 * a day-scaled axis (custom absolute-positioned layout + an SVG overlay for
 * dependency arrows — no charting dependency), with a fixed left label column
 * and a horizontally scrollable timeline. Clicking a bar opens the task via the
 * existing modal intercept. Nothing here writes; geometry comes from the pure
 * buildGantt helper.
 */
export function ProjectGantt({
  tasks,
  dependencies,
  todayStr,
}: {
  tasks: GanttInputTask[];
  dependencies: GanttInputDependency[];
  todayStr: string;
}) {
  const layout = useMemo(
    () => buildGantt(tasks, dependencies, todayStr),
    [tasks, dependencies, todayStr],
  );

  if (tasks.length === 0) {
    return (
      <EmptyState
        title="No tasks to plot"
        description="This project has no tasks you can see."
      />
    );
  }

  const barsAreaH = Math.max(layout.height, layout.rowHeight);

  return (
    <div>
      <Legend />

      {layout.bars.length === 0 ? (
        <p className="text-muted-foreground mb-4 text-sm">
          No tasks have dates yet — see “Unscheduled” below.
        </p>
      ) : (
        <div className="flex rounded-lg border">
          {/* Fixed label column (not horizontally scrolled). */}
          <div className="bg-card sticky left-0 z-10 shrink-0 border-r" style={{ width: LABEL_W }}>
            <div
              className="text-muted-foreground border-b px-3 text-xs font-medium"
              style={{ height: HEADER_H, lineHeight: `${HEADER_H}px` }}
            >
              Task
            </div>
            {layout.bars.map((b) => (
              <div
                key={b.id}
                className="flex items-center gap-1 truncate border-b px-3 text-xs last:border-b-0"
                style={{ height: layout.rowHeight }}
                title={`${b.task_no ?? ""} ${b.title}`}
              >
                <Link
                  href={`/tasks/${b.id}`}
                  className="truncate hover:underline"
                >
                  <span className="text-muted-foreground font-mono">
                    {b.task_no ?? "—"}
                  </span>{" "}
                  {b.title}
                </Link>
              </div>
            ))}
          </div>

          {/* Scrollable timeline. */}
          <div className="overflow-x-auto">
            <div className="relative" style={{ width: layout.width }}>
              {/* Axis header with month gridline labels. */}
              <div className="relative border-b" style={{ height: HEADER_H }}>
                {layout.gridlines.map((g) => (
                  <span
                    key={g.x}
                    className="text-muted-foreground absolute top-0 whitespace-nowrap pl-1 text-xs"
                    style={{ left: g.x, lineHeight: `${HEADER_H}px` }}
                  >
                    {g.label}
                  </span>
                ))}
              </div>

              {/* Bars + gridlines + arrows. */}
              <div className="relative" style={{ height: barsAreaH }}>
                {/* Vertical month gridlines. */}
                {layout.gridlines.map((g) => (
                  <div
                    key={g.x}
                    className="bg-border/60 absolute top-0 w-px"
                    style={{ left: g.x, height: barsAreaH }}
                    aria-hidden="true"
                  />
                ))}

                {/* Dependency arrows (blocker → blocked), restrained styling. */}
                {layout.arrows.length > 0 && (
                  <svg
                    className="pointer-events-none absolute inset-0"
                    width={layout.width}
                    height={barsAreaH}
                    aria-hidden="true"
                  >
                    <defs>
                      <marker
                        id="gantt-arrow"
                        markerWidth="6"
                        markerHeight="6"
                        refX="5"
                        refY="3"
                        orient="auto"
                      >
                        <path
                          d="M0,0 L6,3 L0,6 Z"
                          className="fill-muted-foreground/50"
                        />
                      </marker>
                    </defs>
                    {layout.arrows.map((a) => (
                      <path
                        key={`${a.fromId}-${a.toId}`}
                        d={`M${a.x1},${a.y1} C${a.x1 + 20},${a.y1} ${a.x2 - 20},${a.y2} ${a.x2},${a.y2}`}
                        className="stroke-muted-foreground/40 fill-none"
                        strokeWidth={1.5}
                        markerEnd="url(#gantt-arrow)"
                      />
                    ))}
                  </svg>
                )}

                {/* Bars. */}
                {layout.bars.map((b) => (
                  <Link
                    key={b.id}
                    href={`/tasks/${b.id}`}
                    title={`${b.task_no ?? ""} ${b.title}`}
                    className={cn(
                      "bg-card absolute flex items-center gap-1 overflow-hidden rounded-md border px-2 text-xs shadow-sm",
                      "hover:ring-primary/40 hover:ring-2",
                      b.overdue && "border-destructive",
                    )}
                    style={{
                      left: b.x,
                      width: b.width,
                      top: b.row * layout.rowHeight + BAR_PAD,
                      height: layout.rowHeight - BAR_PAD * 2,
                      borderLeftWidth: 4,
                      borderLeftColor: `var(--color-status-${b.status})`,
                    }}
                  >
                    {b.isMarker ? (
                      <CircleDot className="size-3 shrink-0" aria-hidden="true" />
                    ) : null}
                    <span className="truncate font-mono">{b.task_no ?? "—"}</span>
                    {b.overdue && (
                      <AlertTriangle
                        className="text-destructive size-3 shrink-0"
                        aria-label="Overdue"
                      />
                    )}
                    {b.hasExternalBlocker && (
                      <Link2
                        className="text-muted-foreground size-3 shrink-0"
                        aria-label="Has an external blocker"
                      />
                    )}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <p className="text-muted-foreground mt-2 text-xs">
        {formatDate(layout.windowStart)} – {formatDate(layout.windowEnd)} · drag
        to scroll horizontally
      </p>

      {layout.unscheduled.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-1 text-sm font-semibold">
            Unscheduled{" "}
            <span className="text-muted-foreground font-normal">
              ({layout.unscheduled.length})
            </span>
          </h3>
          <p className="text-muted-foreground mb-2 text-xs">
            These tasks have no start or due date, so they can&apos;t be placed on
            the timeline.
          </p>
          <ul className="flex flex-wrap gap-2">
            {layout.unscheduled.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/tasks/${t.id}`}
                  className="hover:bg-muted flex items-center gap-2 rounded-md border px-2 py-1 text-xs"
                  title={`${t.task_no ?? ""} ${t.title}`}
                >
                  <span className="text-muted-foreground font-mono">
                    {t.task_no ?? "—"}
                  </span>
                  <span className="max-w-40 truncate">{t.title}</span>
                  <StatusBadge status={t.status} />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Legend() {
  return (
    <div className="text-muted-foreground mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
      <span className="flex items-center gap-1">
        <span
          className="inline-block h-3 w-4 rounded-sm border"
          style={{ borderLeftWidth: 4, borderLeftColor: "var(--color-status-in_progress)" }}
          aria-hidden="true"
        />
        bar = start → due (color = status)
      </span>
      <span className="flex items-center gap-1">
        <CircleDot className="size-3" aria-hidden="true" /> single-date marker
      </span>
      <span className="flex items-center gap-1">
        <AlertTriangle className="text-destructive size-3" aria-hidden="true" /> overdue
      </span>
      <span className="flex items-center gap-1">
        <Link2 className="size-3" aria-hidden="true" /> external blocker
      </span>
      <span>→ arrow = blocked by</span>
    </div>
  );
}
