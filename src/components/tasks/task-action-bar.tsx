"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import {
  getAvailableActions,
  type ActionDescriptor,
} from "@/lib/tasks/transitions";
import { transitionTaskAction } from "@/lib/actions/tasks";
import { addUpdateAction } from "@/lib/actions/collaboration";
import type { TaskStatus, UserRole, AssignableUser } from "@/lib/data/types";
import type { LastUpdate } from "@/lib/tasks/last-update";
import { formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function TaskActionBar({
  taskId,
  status,
  role,
  permissions,
  users,
  lastUpdate,
  currentProgress,
  startBlockedReason,
  submitBlockedReason,
}: {
  taskId: string;
  status: TaskStatus;
  role: UserRole;
  permissions: string[];
  users: AssignableUser[];
  // The task's most recent committed update (for the "continue from context"
  // panel + progress pre-fill) and the task's current progress as a fallback.
  lastUpdate?: LastUpdate | null;
  currentProgress?: number;
  // When set, logging progress would START the task (→ in_progress) but it has
  // incomplete blockers — the Log Progress action is disabled with this reason.
  // The server (addUpdateAction) enforces this regardless of the affordance.
  startBlockedReason?: string | null;
  // When set, submitting for review is blocked because the task has open child
  // subtasks — the Submit-for-Review action is disabled with this reason. The
  // server (transitionTaskAction) enforces this regardless of the affordance.
  submitBlockedReason?: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [active, setActive] = useState<ActionDescriptor | null>(null);

  // dialog inputs
  const [reason, setReason] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [closureSummary, setClosureSummary] = useState("");
  const [rating, setRating] = useState("5");
  const [progress, setProgress] = useState("");
  const [updateComment, setUpdateComment] = useState("");

  const actions = getAvailableActions(status, role, permissions);
  if (actions.length === 0) return null;

  const reset = () => {
    setReason("");
    setAssigneeId("");
    setClosureSummary("");
    setRating("5");
    setProgress("");
    setUpdateComment("");
  };

  const run = (
    fn: () => Promise<{ ok: boolean; error?: string }>,
    successMsg: string,
  ) => {
    startTransition(async () => {
      const res = await fn();
      if (res.ok) {
        toast.success(successMsg);
        setActive(null);
        reset();
        router.refresh();
      } else {
        toast.error(res.error ?? "Action failed");
      }
    });
  };

  const onClick = (a: ActionDescriptor) => {
    if (a.requires === "none") {
      run(() => transitionTaskAction(taskId, a.action), `${a.label} done`);
    } else {
      // Pre-fill the progress input so the user continues from the last recorded
      // value (latest update's progress, else the task's current progress).
      if (a.requires === "progress") {
        const seed = lastUpdate?.progress_percentage ?? currentProgress;
        setProgress(seed != null ? String(seed) : "");
      }
      setActive(a);
    }
  };

  const submitDialog = () => {
    if (!active) return;
    if (active.action === "log_progress") {
      const pct = Number(progress);
      run(
        () =>
          addUpdateAction(taskId, {
            progress_percentage: Number.isFinite(pct) ? pct : 0,
            status_update_comment: updateComment || undefined,
          }),
        "Progress logged",
      );
      return;
    }
    run(
      () =>
        transitionTaskAction(taskId, active.action, {
          reason: reason || undefined,
          assignee_id: assigneeId || undefined,
          closure_summary: closureSummary || undefined,
          quality_rating:
            active.requires === "closure" ? Number(rating) : undefined,
        }),
      `${active.label} done`,
    );
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {actions.map((a) => {
          // Logging progress on a startable task auto-advances it to in_progress;
          // submit_review enters pending_review. Disable each affordance when its
          // respective guard is blocking (the server enforces both regardless).
          const reason =
            a.action === "log_progress"
              ? (startBlockedReason ?? null)
              : a.action === "submit_review"
                ? (submitBlockedReason ?? null)
                : null;
          const blocked = Boolean(reason);
          return (
            <Button
              key={a.action}
              variant={a.variant}
              size="sm"
              disabled={pending || blocked}
              title={blocked ? (reason ?? undefined) : undefined}
              onClick={() => onClick(a)}
            >
              {a.label}
            </Button>
          );
        })}
      </div>
      {startBlockedReason && (
        <p className="text-muted-foreground mt-1 text-xs">{startBlockedReason}</p>
      )}
      {submitBlockedReason && (
        <p className="text-muted-foreground mt-1 text-xs">{submitBlockedReason}</p>
      )}

      <Dialog
        open={active !== null}
        onOpenChange={(o) => !o && setActive(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{active?.label}</DialogTitle>
          </DialogHeader>

          {active?.requires === "reason" && (
            <div className="space-y-2">
              <Label htmlFor="reason">Reason</Label>
              <Textarea
                id="reason"
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Explain why…"
              />
            </div>
          )}

          {active?.requires === "assignee" && (
            <div className="space-y-2">
              <Label>Assignee</Label>
              <Select value={assigneeId} onValueChange={setAssigneeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a user" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.full_name || u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {active?.requires === "closure" && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="summary">Closure summary</Label>
                <Textarea
                  id="summary"
                  rows={3}
                  value={closureSummary}
                  onChange={(e) => setClosureSummary(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Quality rating</Label>
                <Select value={rating} onValueChange={setRating}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n} / 5
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {active?.requires === "progress" && (
            <div className="space-y-3">
              {lastUpdate && (
                <div className="bg-muted/40 space-y-1 rounded-md border p-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">
                      Last update · {lastUpdate.progress_percentage}%
                    </span>
                    <span className="text-muted-foreground">
                      {lastUpdate.updater_name ?? "—"} ·{" "}
                      {formatDateTime(lastUpdate.created_at)}
                    </span>
                  </div>
                  {lastUpdate.status_update_comment && (
                    <p className="text-muted-foreground whitespace-pre-wrap">
                      {lastUpdate.status_update_comment}
                    </p>
                  )}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="progress">Progress %</Label>
                <Input
                  id="progress"
                  type="number"
                  min="0"
                  max="100"
                  value={progress}
                  onChange={(e) => setProgress(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="uc">Update note</Label>
                <Textarea
                  id="uc"
                  rows={3}
                  value={updateComment}
                  onChange={(e) => setUpdateComment(e.target.value)}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button onClick={submitDialog} disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
