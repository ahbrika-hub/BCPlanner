"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { GripVertical, MoveRight, AlertTriangle } from "lucide-react";

import { cn } from "@/lib/utils";
import { transitionTaskAction } from "@/lib/actions/tasks";
import {
  LANES,
  laneForStatus,
  resolveBoardDrop,
  actionableTargets,
  isCardDraggable,
  type Lane,
  type LaneKey,
} from "@/lib/tasks/board";
import { isOverdue } from "@/lib/tasks/overdue";
import type { TaskWithRelations, TaskStatus } from "@/lib/data/types";
import { StatusBadge } from "@/components/ui/status-badge";
import { PriorityPill } from "@/components/ui/priority-pill";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const DRAG_MIME = "text/plain";

/**
 * Grouped-lane Kanban board. Dragging a card to another lane resolves to ONE
 * guard-legal transition and runs the EXISTING `transitionTaskAction` — the same
 * permission check, DB guard, and notifications as the task action bar. The drag
 * is only a trigger; it never writes a status directly and adds NO server path.
 *
 *  • Legal + no-extra-fields move  → optimistic move, reverts on failure.
 *  • Legal but needs fields (Close)→ opens the task (the action bar's dialog
 *                                    collects them); the board commits nothing.
 *  • Illegal / unpermitted move    → rejected with a clear toast; card unchanged.
 *
 * Cards with no actionable move for the viewer are not draggable (no affordance).
 * A per-card "Move" menu is the keyboard- and touch-accessible equivalent of the
 * pointer drag (native HTML5 DnD is pointer-based) and runs the identical path.
 */
export function KanbanBoard({
  tasks: initialTasks,
  permissions,
}: {
  tasks: TaskWithRelations[];
  permissions: string[];
}) {
  const router = useRouter();
  const [tasks, setTasks] = useState<TaskWithRelations[]>(initialTasks);
  const [pending, startTransition] = useTransition();
  const [dragTargets, setDragTargets] = useState<LaneKey[] | null>(null);
  const [dragOver, setDragOver] = useState<LaneKey | null>(null);

  // Resync the optimistic copy when fresh server data arrives (after
  // router.refresh()) — the "adjust state while rendering" pattern, avoiding a
  // setState-in-effect (same approach as the reassign board).
  const [prevInitial, setPrevInitial] = useState(initialTasks);
  if (prevInitial !== initialTasks) {
    setPrevInitial(initialTasks);
    setTasks(initialTasks);
  }

  const tasksByLane = useMemo(() => {
    const map = new Map<LaneKey, TaskWithRelations[]>(
      LANES.map((l) => [l.key, []]),
    );
    for (const t of tasks) {
      map.get(laneForStatus(t.status).key)?.push(t);
    }
    return map;
  }, [tasks]);

  /** Commit a resolved move for a task onto a target lane (drag OR menu). */
  const moveToLane = (task: TaskWithRelations, lane: Lane) => {
    if (pending) return;
    const resolution = resolveBoardDrop(task.status, lane, permissions);
    const label = `${task.task_no ?? "Task"}`;

    switch (resolution.kind) {
      case "noop":
        return;
      case "not_target":
        toast.info(`${lane.label} is reached by logging progress, not by dragging.`);
        return;
      case "illegal":
        toast.error(
          `Can't move ${label} from ${resolution.fromLabel} to ${resolution.toLabel}.`,
        );
        return;
      case "needs_permission":
        toast.error(`You don't have permission to ${resolution.descriptor.label}.`);
        return;
      case "needs_fields": {
        // Never bypass a required field — open the task so the action bar's
        // dialog can collect them. The board writes nothing here.
        toast.info(
          `${resolution.descriptor.label} needs more details — opening ${label}.`,
        );
        router.push(`/tasks/${task.id}`);
        return;
      }
      case "ready": {
        const previousStatus = task.status;
        const nextStatus = lane.primaryTarget as TaskStatus;
        const action = resolution.descriptor.action;
        // Optimistic move.
        setTasks((cur) =>
          cur.map((t) =>
            t.id === task.id ? { ...t, status: nextStatus } : t,
          ),
        );
        startTransition(async () => {
          const res = await transitionTaskAction(task.id, action);
          if (res.ok) {
            toast.success(`${resolution.descriptor.label}: ${label}`);
            router.refresh();
          } else {
            // Revert only this card (don't clobber other in-flight changes).
            setTasks((cur) =>
              cur.map((t) =>
                t.id === task.id ? { ...t, status: previousStatus } : t,
              ),
            );
            toast.error(res.error);
          }
        });
        return;
      }
    }
  };

  const onDragStart = (e: React.DragEvent, task: TaskWithRelations) => {
    e.dataTransfer.setData(DRAG_MIME, task.id);
    e.dataTransfer.effectAllowed = "move";
    setDragTargets(actionableTargets(task.status, permissions));
  };

  const onDragEnd = () => {
    setDragTargets(null);
    setDragOver(null);
  };

  const onDrop = (e: React.DragEvent, lane: Lane) => {
    e.preventDefault();
    setDragOver(null);
    setDragTargets(null);
    const id = e.dataTransfer.getData(DRAG_MIME);
    const task = tasks.find((t) => t.id === id);
    if (task) moveToLane(task, lane);
  };

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {LANES.map((lane) => {
        const laneTasks = tasksByLane.get(lane.key) ?? [];
        const isValidTarget = dragTargets?.includes(lane.key) ?? false;
        const dragging = dragTargets !== null;
        return (
          <section
            key={lane.key}
            aria-label={lane.label}
            onDragOver={(e) => {
              // Only accept the drop (and show the hover ring) on valid targets.
              if (isValidTarget) {
                e.preventDefault();
                setDragOver(lane.key);
              }
            }}
            onDragLeave={() => setDragOver(null)}
            onDrop={(e) => onDrop(e, lane)}
            className={cn(
              "bg-muted/40 flex w-72 shrink-0 flex-col rounded-lg border",
              "transition-colors",
              dragOver === lane.key && "ring-primary ring-2",
              // During a drag, dim lanes that can't accept this card.
              dragging && !isValidTarget && "opacity-50",
              dragging && isValidTarget && "border-primary/50",
            )}
          >
            <header className="flex items-center justify-between border-b px-3 py-2">
              <span className="text-sm font-semibold">{lane.label}</span>
              <span className="text-muted-foreground text-xs">
                {laneTasks.length}
              </span>
            </header>
            <div className="flex max-h-[calc(100vh-16rem)] flex-col gap-2 overflow-y-auto p-2">
              {laneTasks.length === 0 ? (
                <p className="text-muted-foreground px-1 py-6 text-center text-xs">
                  No tasks
                </p>
              ) : (
                laneTasks.map((task) => (
                  <BoardCard
                    key={task.id}
                    task={task}
                    permissions={permissions}
                    pending={pending}
                    onDragStart={onDragStart}
                    onDragEnd={onDragEnd}
                    onMove={moveToLane}
                  />
                ))
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function BoardCard({
  task,
  permissions,
  pending,
  onDragStart,
  onDragEnd,
  onMove,
}: {
  task: TaskWithRelations;
  permissions: string[];
  pending: boolean;
  onDragStart: (e: React.DragEvent, task: TaskWithRelations) => void;
  onDragEnd: () => void;
  onMove: (task: TaskWithRelations, lane: Lane) => void;
}) {
  const draggable = isCardDraggable(task.status, permissions);
  const overdue = isOverdue(task.due_date, task.status);
  // Lanes this card can actually move to (for the touch/keyboard Move menu).
  const targets = useMemo(
    () =>
      actionableTargets(task.status, permissions)
        .map((key) => LANES.find((l) => l.key === key))
        .filter((l): l is Lane => Boolean(l)),
    [task.status, permissions],
  );

  return (
    <div
      draggable={draggable && !pending}
      onDragStart={(e) => onDragStart(e, task)}
      onDragEnd={onDragEnd}
      className={cn(
        "bg-background rounded-md border p-2.5 text-sm shadow-sm",
        draggable && !pending && "cursor-grab active:cursor-grabbing",
        pending && "opacity-80",
      )}
    >
      <div className="flex items-start gap-1.5">
        {draggable && (
          <GripVertical
            className="text-muted-foreground mt-0.5 size-3.5 shrink-0"
            aria-hidden="true"
          />
        )}
        <div className="min-w-0 flex-1">
          <Link
            href={`/tasks/${task.id}`}
            className="font-medium hover:underline"
          >
            {task.title}
          </Link>
          <div className="text-muted-foreground mt-0.5 font-mono text-xs">
            {task.task_no ?? "—"}
          </div>
        </div>
        {targets.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="Move task"
              className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 -m-1 rounded p-1 outline-none focus-visible:ring-2"
            >
              <MoveRight className="size-4" aria-hidden="true" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Move to…</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {targets.map((lane) => (
                <DropdownMenuItem
                  key={lane.key}
                  disabled={pending}
                  onSelect={() => onMove(task, lane)}
                >
                  {lane.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <StatusBadge status={task.status} />
        <PriorityPill priority={task.priority} />
        {overdue && (
          <Badge variant="destructive" className="bg-destructive gap-1 text-white">
            <AlertTriangle className="size-3" aria-hidden="true" />
            Overdue
          </Badge>
        )}
      </div>
      <div className="text-muted-foreground mt-1.5 truncate text-xs">
        {task.assignee?.full_name ?? "Unassigned"}
      </div>
    </div>
  );
}
