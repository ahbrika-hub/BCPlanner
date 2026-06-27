"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, X, Link2 } from "lucide-react";

import {
  addDependencyAction,
  removeDependencyAction,
} from "@/lib/actions/dependencies";
import type { DependencyRef } from "@/lib/data/dependencies";
import type { TaskBrief } from "@/lib/data/tasks";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * "Blocked by" / "Blocking" dependency editor on the task detail. Adding a
 * dependency calls the server action (which runs through RLS + the DB cycle
 * guard); self/cycle/duplicate are rejected server-side and surfaced as toasts.
 * The block-START rule (no entering in_progress until blockers complete) is
 * enforced server-side in addUpdateAction regardless of this UI.
 */
export function TaskDependencies({
  taskId,
  blockers,
  blocking,
  candidates,
  canEdit,
}: {
  taskId: string;
  blockers: DependencyRef[];
  blocking: DependencyRef[];
  /** Visible tasks the user may pick as a blocker (already excludes self). */
  candidates: TaskBrief[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState("");

  // Don't offer tasks that are already blockers.
  const options = useMemo(() => {
    const taken = new Set(blockers.map((b) => b.depends_on_task_id));
    return candidates.filter((c) => c.id !== taskId && !taken.has(c.id));
  }, [candidates, blockers, taskId]);

  const onAdd = () => {
    if (!selected) return;
    startTransition(async () => {
      const res = await addDependencyAction(taskId, selected);
      if (res.ok) {
        toast.success("Dependency added");
        setSelected("");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  };

  const onRemove = (id: string) => {
    startTransition(async () => {
      const res = await removeDependencyAction(id, taskId);
      if (res.ok) {
        toast.success("Dependency removed");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="mb-2 text-sm font-semibold">Blocked by</h3>
        {blockers.length === 0 ? (
          <p className="text-muted-foreground text-xs">
            No blockers. This task can start freely.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {blockers.map((b) => (
              <li
                key={b.id}
                className="flex items-center gap-2 rounded-md border px-2 py-1.5 text-sm"
              >
                <Link2 className="text-muted-foreground size-3.5 shrink-0" aria-hidden="true" />
                <Link
                  href={`/tasks/${b.task.id}`}
                  className="font-mono text-xs hover:underline"
                >
                  {b.task.task_no ?? "—"}
                </Link>
                <span className="min-w-0 flex-1 truncate">{b.task.title}</span>
                <StatusBadge status={b.task.status} />
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => onRemove(b.id)}
                    disabled={pending}
                    aria-label="Remove dependency"
                    className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 rounded p-0.5 outline-none focus-visible:ring-2"
                  >
                    <X className="size-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        {canEdit && options.length > 0 && (
          <div className="mt-2 flex items-center gap-2">
            <Select value={selected} onValueChange={setSelected}>
              <SelectTrigger className="h-9 flex-1">
                <SelectValue placeholder="Add a blocker…" />
              </SelectTrigger>
              <SelectContent>
                {options.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.task_no ? `${t.task_no} · ` : ""}
                    {t.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              size="sm"
              onClick={onAdd}
              disabled={pending || !selected}
            >
              <Plus className="size-4" />
              Add
            </Button>
          </div>
        )}
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold">Blocking</h3>
        {blocking.length === 0 ? (
          <p className="text-muted-foreground text-xs">
            This task is not blocking any others.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {blocking.map((b) => (
              <li
                key={b.id}
                className="flex items-center gap-2 rounded-md border px-2 py-1.5 text-sm"
              >
                <Link2 className="text-muted-foreground size-3.5 shrink-0" aria-hidden="true" />
                <Link
                  href={`/tasks/${b.task.id}`}
                  className="font-mono text-xs hover:underline"
                >
                  {b.task.task_no ?? "—"}
                </Link>
                <span className="min-w-0 flex-1 truncate">{b.task.title}</span>
                <StatusBadge status={b.task.status} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
