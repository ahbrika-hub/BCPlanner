"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { GripVertical } from "lucide-react";

import { cn } from "@/lib/utils";
import { transitionTaskAction } from "@/lib/actions/tasks";
import type { ReassignableTask } from "@/lib/data/workload";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

type Employee = { id: string; full_name: string };

const UNASSIGNED = "__unassigned__";

/**
 * Drag-to-reassign board (managers with tasks.assign only — the page gates
 * rendering). Dragging a task chip onto another employee column calls the
 * EXISTING assignment action — `transitionTaskAction(id, "assign", { assignee_id })`
 * — so the same permission check, transition guard, and notifications apply; the
 * drag is purely a trigger and adds NO new server path. The move is optimistic and
 * reverts on failure. The "Unassigned" column is a drag SOURCE only (the assign
 * action always targets a person). Tasks whose status the guard would reject are
 * not present here (see getReassignableTasks). Native HTML5 DnD — no new dep; the
 * task action bar's Assign control remains the keyboard-accessible path.
 */
export function ReassignBoard({
  employees,
  tasks: initialTasks,
}: {
  employees: Employee[];
  tasks: ReassignableTask[];
}) {
  const router = useRouter();
  const [tasks, setTasks] = useState<ReassignableTask[]>(initialTasks);
  const [pending, startTransition] = useTransition();
  const [dragOver, setDragOver] = useState<string | null>(null);

  // Resync when the server data changes (e.g. after router.refresh()) so the
  // optimistic copy can't drift — React's "adjust state while rendering" pattern
  // (a new initialTasks reference arrives only from a server re-render), which
  // avoids a setState-in-effect.
  const [prevInitial, setPrevInitial] = useState(initialTasks);
  if (prevInitial !== initialTasks) {
    setPrevInitial(initialTasks);
    setTasks(initialTasks);
  }

  // Columns: every active employee, plus any assignee referenced by a task who
  // isn't in the active set (e.g. a deactivated user) — otherwise their tasks
  // would have no column and silently vanish. Names resolve from the employee
  // list first, then the task's own assignee_name.
  const { columns, nameById } = useMemo(() => {
    const names = new Map(employees.map((e) => [e.id, e.full_name]));
    for (const t of tasks) {
      if (t.assignee_id && !names.has(t.assignee_id)) {
        names.set(t.assignee_id, t.assignee_name ?? "Unknown");
      }
    }
    const cols: { key: string; label: string }[] = [
      { key: UNASSIGNED, label: "Unassigned" },
      ...[...names.entries()].map(([key, label]) => ({ key, label })),
    ];
    return { columns: cols, nameById: names };
  }, [employees, tasks]);

  const tasksFor = (key: string) =>
    tasks.filter((t) =>
      key === UNASSIGNED ? t.assignee_id === null : t.assignee_id === key,
    );

  const onDrop = (e: React.DragEvent, targetKey: string) => {
    e.preventDefault();
    setDragOver(null);
    // Ignore drops onto "nobody", or while a reassignment is in flight (avoids
    // overlapping optimistic updates clobbering each other).
    if (targetKey === UNASSIGNED || pending) return;
    const taskId = e.dataTransfer.getData("text/plain");
    if (!taskId) return;
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.assignee_id === targetKey) return;

    const previousAssignee = task.assignee_id;
    // Optimistic move.
    setTasks((cur) =>
      cur.map((t) => (t.id === taskId ? { ...t, assignee_id: targetKey } : t)),
    );

    startTransition(async () => {
      const res = await transitionTaskAction(taskId, "assign", {
        assignee_id: targetKey,
      });
      if (res.ok) {
        toast.success(
          `Reassigned ${task.task_no ?? "task"} to ${nameById.get(targetKey) ?? "user"}`,
        );
        router.refresh();
      } else {
        // Revert only the moved task (don't clobber other in-flight changes).
        setTasks((cur) =>
          cur.map((t) =>
            t.id === taskId ? { ...t, assignee_id: previousAssignee } : t,
          ),
        );
        toast.error(res.error);
      }
    });
  };

  return (
    <div className="mt-8">
      <h2 className="mb-1 text-sm font-semibold">Reassign (drag &amp; drop)</h2>
      <p className="text-muted-foreground mb-3 text-xs">
        Drag a task onto a teammate to reassign it. Runs the same Assign action
        and approval guard as the task page.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {columns.map((col) => {
          const colTasks = tasksFor(col.key);
          const isDropTarget = col.key !== UNASSIGNED;
          return (
            <Card
              key={col.key}
              onDragOver={
                isDropTarget
                  ? (e) => {
                      e.preventDefault();
                      setDragOver(col.key);
                    }
                  : undefined
              }
              onDragLeave={isDropTarget ? () => setDragOver(null) : undefined}
              onDrop={isDropTarget ? (e) => onDrop(e, col.key) : undefined}
              className={cn(
                "transition-colors",
                dragOver === col.key && "ring-primary ring-2",
                pending && "opacity-80",
              )}
            >
              <CardHeader className="py-3">
                <div className="flex items-center justify-between">
                  <span className="truncate text-sm font-medium">
                    {col.label}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {colTasks.length}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {colTasks.length === 0 ? (
                  <p className="text-muted-foreground text-xs">No tasks</p>
                ) : (
                  colTasks.map((t) => (
                    <div
                      key={t.id}
                      draggable
                      onDragStart={(e) =>
                        e.dataTransfer.setData("text/plain", t.id)
                      }
                      title={`${t.task_no ?? ""} ${t.title}`}
                      className="bg-muted/40 hover:bg-muted flex cursor-grab items-center gap-2 rounded-md border px-2 py-1.5 text-xs active:cursor-grabbing"
                    >
                      <GripVertical className="text-muted-foreground size-3.5 shrink-0" />
                      <span className="text-muted-foreground font-mono">
                        {t.task_no ?? "—"}
                      </span>
                      <span className="truncate">{t.title}</span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
