"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

import {
  bulkTransitionTasks,
  type BulkTransitionResult,
} from "@/lib/actions/bulk-tasks";
import type { TaskAction, ActionInput } from "@/lib/tasks/transitions";
import type { TaskStatus, UserRole } from "@/lib/data/types";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/status-badge";
import { Badge } from "@/components/ui/badge";
import { ConvertCeoRequestDialog } from "@/components/tasks/convert-ceo-request-dialog";
import type { AssignableUser, BusinessLineRow } from "@/lib/data/types";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { TaskActionBar } from "@/components/tasks/task-action-bar";

export type QueueTask = {
  id: string;
  task_no: string | null;
  title: string;
  status: TaskStatus;
  creator_name: string | null;
  creator_role: UserRole | null;
  assignee_name: string | null;
  created_at: string;
  sharepoint_url: string | null;
};

export type BulkActionDescriptor = {
  action: TaskAction;
  label: string;
  requires: ActionInput;
  variant: "default" | "secondary" | "outline" | "destructive";
};

export function BulkQueue({
  tasks,
  actions,
  role,
  permissions,
  businessLines = [],
  users = [],
}: {
  tasks: QueueTask[];
  actions: BulkActionDescriptor[];
  role: UserRole;
  permissions: string[];
  // Supplied on the approvals surface so a manager can convert a CEO request.
  businessLines?: BusinessLineRow[];
  users?: AssignableUser[];
}) {
  // A manager can convert + assign a CEO request (has both perms).
  const canConvert =
    permissions.includes("tasks.approve") &&
    permissions.includes("tasks.assign");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [active, setActive] = useState<BulkActionDescriptor | null>(null);
  const [reason, setReason] = useState("");
  const [closureSummary, setClosureSummary] = useState("");
  const [rating, setRating] = useState("5");
  const [results, setResults] = useState<BulkTransitionResult | null>(null);

  const allIds = useMemo(() => tasks.map((t) => t.id), [tasks]);
  const byId = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);
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
  const hasSelection = selectedIds.length > 0;

  const toggle = (id: string, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  const toggleAll = (on: boolean) =>
    setSelected(on ? new Set(allIds) : new Set());

  const resetDialog = () => {
    setActive(null);
    setReason("");
    setClosureSummary("");
    setRating("5");
  };

  const canConfirm = () => {
    if (!active) return false;
    if (active.requires === "reason") return reason.trim().length > 0;
    if (active.requires === "closure") return closureSummary.trim().length > 0;
    return true;
  };

  const submit = () => {
    if (!active) return;
    const a = active;
    const payload =
      a.requires === "reason"
        ? { reason: reason.trim() }
        : a.requires === "closure"
          ? { closure_summary: closureSummary.trim(), quality_rating: Number(rating) }
          : {};
    startTransition(async () => {
      const res = await bulkTransitionTasks(selectedIds, a.action, payload);
      resetDialog();
      if (res.refused) {
        toast.error(res.refused);
        return;
      }
      setResults(res);
      // Clear only the ones that succeeded; leave failed selected for a retry.
      const failedIds = new Set(res.results.filter((r) => !r.ok).map((r) => r.taskId));
      setSelected(failedIds);
      toast[res.failed === 0 ? "success" : "message"](
        `${res.succeeded} ${a.label.toLowerCase()} · ${res.failed} failed`,
      );
      router.refresh();
    });
  };

  return (
    <div className="space-y-3">
      {/* Toolbar: select-all (indeterminate) + bulk action bar (when selecting). */}
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={allChecked}
            onCheckedChange={(v) => toggleAll(v === true)}
            aria-label="Select all tasks"
            disabled={pending}
          />
          {hasSelection ? `${selectedIds.length} selected` : "Select all"}
        </label>

        {hasSelection && (
          <div className="ms-auto flex flex-wrap items-center gap-2">
            {actions.map((a) => (
              <Button
                key={a.action}
                variant={a.variant}
                size="sm"
                disabled={pending}
                onClick={() => setActive(a)}
              >
                {a.label}
              </Button>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-3">
        {tasks.map((t) => {
          const isSel = selected.has(t.id);
          return (
            <Card key={t.id} className={cn(isSel && "border-primary/40")}>
              <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <Checkbox
                    className="mt-1"
                    checked={isSel}
                    onCheckedChange={(v) => toggle(t.id, v === true)}
                    aria-label={`Select ${t.task_no ?? t.title}`}
                    disabled={pending}
                  />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/tasks/${t.id}`}
                        className="font-medium hover:underline"
                      >
                        {t.title}
                      </Link>
                      <StatusBadge status={t.status} />
                      {t.creator_role === "ceo" &&
                        t.status === "pending_approval" && (
                          <Badge variant="secondary">CEO request</Badge>
                        )}
                    </div>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {t.task_no} · {t.creator_name ?? "—"} ·{" "}
                      {t.assignee_name ? `assignee ${t.assignee_name} · ` : ""}
                      {formatDate(t.created_at)}
                    </p>
                    {t.sharepoint_url && (
                      <a
                        href={t.sharepoint_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary mt-1 inline-block text-xs break-all hover:underline"
                      >
                        Open in SharePoint
                      </a>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {/* One-step convert for a CEO request (set details + assign). */}
                  {canConvert &&
                    t.creator_role === "ceo" &&
                    t.status === "pending_approval" && (
                      <ConvertCeoRequestDialog
                        taskId={t.id}
                        title={t.title}
                        businessLines={businessLines}
                        users={users}
                      />
                    )}
                  {/* Single-task actions remain available, unchanged. */}
                  <TaskActionBar
                    taskId={t.id}
                    status={t.status}
                    role={role}
                    permissions={permissions}
                    users={[]}
                  />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Confirm step — shows the action + count, collects any required input. */}
      <Dialog open={active !== null} onOpenChange={(o) => !o && resetDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {active?.label} {selectedIds.length} task
              {selectedIds.length === 1 ? "" : "s"}?
            </DialogTitle>
            <DialogDescription>
              Each task is processed individually; any that can&rsquo;t be{" "}
              {active?.label.toLowerCase()} are reported and left unchanged.
            </DialogDescription>
          </DialogHeader>

          {active?.requires === "reason" && (
            <div className="space-y-2">
              <Label htmlFor="bulk-reason">Reason</Label>
              <Textarea
                id="bulk-reason"
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Applied to every selected task…"
              />
            </div>
          )}

          {active?.requires === "closure" && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="bulk-closure">Closure summary</Label>
                <Textarea
                  id="bulk-closure"
                  rows={3}
                  value={closureSummary}
                  onChange={(e) => setClosureSummary(e.target.value)}
                  placeholder="Applied to every selected task…"
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

          <DialogFooter>
            <Button
              variant={active?.variant === "destructive" ? "destructive" : "default"}
              onClick={submit}
              disabled={pending || !canConfirm()}
            >
              {pending && <Loader2 className="size-4 animate-spin" />}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Per-row outcome report. */}
      <Dialog open={results !== null} onOpenChange={(o) => !o && setResults(null)}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Bulk action results</DialogTitle>
            <DialogDescription>
              {results?.succeeded ?? 0} succeeded · {results?.failed ?? 0} failed.
              Failed tasks are unchanged and stay selected.
            </DialogDescription>
          </DialogHeader>
          <ul className="space-y-2">
            {results?.results.map((r) => {
              const t = byId.get(r.taskId);
              return (
                <li key={r.taskId} className="flex items-start gap-2 text-sm">
                  {r.ok ? (
                    <CheckCircle2 className="text-success mt-0.5 size-4 shrink-0" />
                  ) : (
                    <XCircle className="text-danger mt-0.5 size-4 shrink-0" />
                  )}
                  <span className="min-w-0">
                    <span className="font-medium">
                      {t?.task_no ?? r.taskId}
                    </span>
                    {t?.title ? ` — ${t.title}` : ""}
                    {!r.ok && r.reason && (
                      <span className="text-muted-foreground block text-xs">
                        {r.reason}
                      </span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResults(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
