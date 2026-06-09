"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Plus,
  Loader2,
  Play,
  Pencil,
  Trash2,
  RotateCcw,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import type { z } from "zod";

import { createRecurringSchema } from "@/lib/validations";
import {
  createRecurringAction,
  updateRecurringAction,
  deleteRecurringAction,
  restoreRecurringAction,
  generateNowAction,
} from "@/lib/actions/recurring";
import { formatDate } from "@/lib/format";
import type { RecurringWithRelations } from "@/lib/data/recurring";
import type { BusinessLineRow, AssignableUser } from "@/lib/data/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { EmptyState } from "@/components/ui/empty-state";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type FormValues = z.input<typeof createRecurringSchema>;
type EffortUnit = "hours" | "days";
const HOURS_PER_DAY = 8;

function RecurringDialog({
  businessLines,
  users,
  existing,
  trigger,
}: {
  businessLines: BusinessLineRow[];
  users: AssignableUser[];
  existing?: RecurringWithRelations;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(createRecurringSchema),
    defaultValues: existing
      ? {
          title: existing.title,
          description: existing.description ?? undefined,
          category: existing.category ?? undefined,
          business_line_id: existing.business_line_id ?? undefined,
          assignee_id: existing.assignee_id ?? undefined,
          priority: existing.priority,
          frequency: existing.frequency,
          start_date: existing.start_date,
          expected_end_date: existing.expected_end_date ?? undefined,
          estimated_effort_hours: existing.estimated_effort_hours ?? undefined,
          is_active: existing.is_active,
        }
      : { priority: "medium", frequency: "weekly", is_active: true },
  });

  // Effort can be entered in hours or days; the canonical stored value is always
  // hours (days × 8). No stored unit column — purely an input/display convenience.
  const [unit, setUnit] = useState<EffortUnit>("hours");
  const [effortInput, setEffortInput] = useState(
    existing?.estimated_effort_hours != null
      ? String(existing.estimated_effort_hours)
      : "",
  );

  const writeHours = (input: string, u: EffortUnit) => {
    const n = input.trim() === "" ? undefined : Number(input);
    const hours =
      n === undefined || Number.isNaN(n)
        ? undefined
        : u === "days"
          ? n * HOURS_PER_DAY
          : n;
    setValue("estimated_effort_hours", hours as never, {
      shouldValidate: false,
    });
  };

  const onEffortChange = (v: string) => {
    setEffortInput(v);
    writeHours(v, unit);
  };

  // Switching units keeps the stored hours constant; only the displayed number
  // is converted.
  const onUnitChange = (u: EffortUnit) => {
    const n = effortInput.trim() === "" ? undefined : Number(effortInput);
    if (n !== undefined && !Number.isNaN(n)) {
      const hours = unit === "days" ? n * HOURS_PER_DAY : n;
      setEffortInput(u === "days" ? String(hours / HOURS_PER_DAY) : String(hours));
    }
    setUnit(u);
  };

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      const cleaned = Object.fromEntries(
        Object.entries(values).filter(([, v]) => v !== "" && v !== undefined),
      );
      const res = existing
        ? await updateRecurringAction(existing.id, cleaned)
        : await createRecurringAction(cleaned);
      if (res.ok) {
        toast.success(existing ? "Template updated" : "Template created");
        if (!existing)
          reset({ priority: "medium", frequency: "weekly", is_active: true });
        setOpen(false);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit" : "New"} Recurring Task</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" {...register("title")} />
            {errors.title && (
              <p className="text-destructive text-xs">{errors.title.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" rows={2} {...register("description")} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Frequency</Label>
              <Select
                defaultValue={existing?.frequency ?? "weekly"}
                onValueChange={(v) =>
                  setValue("frequency", v as FormValues["frequency"])
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select
                defaultValue={existing?.priority ?? "medium"}
                onValueChange={(v) =>
                  setValue("priority", v as FormValues["priority"])
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Business Line</Label>
              <Select
                defaultValue={existing?.business_line_id ?? undefined}
                onValueChange={(v) => setValue("business_line_id", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select…" />
                </SelectTrigger>
                <SelectContent>
                  {businessLines.map((bl) => (
                    <SelectItem key={bl.id} value={bl.id}>
                      {bl.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Assignee</Label>
              <Select
                defaultValue={existing?.assignee_id ?? undefined}
                onValueChange={(v) => setValue("assignee_id", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Unassigned" />
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
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="start_date">Start date</Label>
              <Input id="start_date" type="date" {...register("start_date")} />
              {errors.start_date && (
                <p className="text-destructive text-xs">Required</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="expected_end_date">Expected end date</Label>
              <Input
                id="expected_end_date"
                type="date"
                {...register("expected_end_date")}
              />
              {errors.expected_end_date && (
                <p className="text-destructive text-xs">
                  {errors.expected_end_date.message}
                </p>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="effort">Estimated effort</Label>
            <div className="flex gap-2">
              <Input
                id="effort"
                type="number"
                step={unit === "days" ? "0.25" : "0.5"}
                min="0"
                className="flex-1"
                value={effortInput}
                onChange={(e) => onEffortChange(e.target.value)}
              />
              <Select
                value={unit}
                onValueChange={(v) => onUnitChange(v as EffortUnit)}
              >
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hours">Hours</SelectItem>
                  <SelectItem value="days">Days</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-muted-foreground text-xs">
              Stored in hours (1 day = 8 hours).
            </p>
            {errors.estimated_effort_hours && (
              <p className="text-destructive text-xs">
                {errors.estimated_effort_hours.message}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              {existing ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function RecurringManager({
  rows,
  deletedRows,
  businessLines,
  users,
}: {
  rows: RecurringWithRelations[];
  deletedRows: RecurringWithRelations[];
  businessLines: BusinessLineRow[];
  users: AssignableUser[];
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const act = (
    fn: () => Promise<{ ok: boolean; error?: string; count?: number }>,
    ok: string,
  ) => {
    startTransition(async () => {
      const res = await fn();
      if (res.ok) {
        toast.success(
          typeof res.count === "number" ? `${res.count} task(s) created` : ok,
        );
        router.refresh();
      } else {
        toast.error(res.error ?? "Failed");
      }
    });
  };

  const restore = (id: string) =>
    act(() => restoreRecurringAction(id), "Recurring task restored");

  // Soft-delete with an Undo toast (restores it within the toast window).
  const remove = (id: string) =>
    startTransition(async () => {
      const res = await deleteRecurringAction(id);
      if (res.ok) {
        toast.success("Recurring task deleted", {
          action: { label: "Undo", onClick: () => restore(id) },
        });
        router.refresh();
      } else {
        toast.error(res.error ?? "Failed");
      }
    });

  return (
    <>
      <div className="mb-4 flex justify-end gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              disabled={pending}
              onClick={() => act(generateNowAction, "Done")}
            >
              <Play className="size-4" />
              Generate Due Tasks Now
              <Info className="text-muted-foreground size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            Runs the schedule now instead of waiting for the daily job: creates a
            task from every active recurring template whose next generation date
            is today or earlier, then advances each template’s schedule.
          </TooltipContent>
        </Tooltip>
        <RecurringDialog
          businessLines={businessLines}
          users={users}
          trigger={
            <Button>
              <Plus className="size-4" />
              New Recurring Task
            </Button>
          }
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="No recurring tasks"
          description="Create a template to generate tasks on a schedule."
        />
      ) : (
        <div className="rounded-lg border">
          <Table stickyFirstColumn>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Frequency</TableHead>
                <TableHead>Assignee</TableHead>
                <TableHead>Next generation</TableHead>
                <TableHead>Active</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.title}</TableCell>
                  <TableCell className="capitalize">{r.frequency}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {r.assignee?.full_name ?? "Unassigned"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {formatDate(r.next_generation_date)}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={pending}
                      onClick={() =>
                        act(
                          () =>
                            updateRecurringAction(r.id, {
                              is_active: !r.is_active,
                            }),
                          "Updated",
                        )
                      }
                    >
                      <Badge variant={r.is_active ? "default" : "secondary"}>
                        {r.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </Button>
                  </TableCell>
                  <TableCell className="text-right">
                    <RecurringDialog
                      businessLines={businessLines}
                      users={users}
                      existing={r}
                      trigger={
                        <Button variant="ghost" size="icon" aria-label="Edit">
                          <Pencil className="size-4" />
                        </Button>
                      }
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Delete"
                      disabled={pending}
                      onClick={() => remove(r.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {deletedRows.length > 0 && (
        <div className="mt-8">
          <h2 className="text-fg-muted mb-2 text-xs font-medium tracking-wide uppercase">
            Recently deleted
          </h2>
          <div className="rounded-lg border">
            <Table stickyFirstColumn>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Frequency</TableHead>
                  <TableHead>Deleted</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deletedRows.map((r) => (
                  <TableRow key={r.id} className="text-muted-foreground">
                    <TableCell className="font-medium">{r.title}</TableCell>
                    <TableCell className="capitalize">{r.frequency}</TableCell>
                    <TableCell className="text-sm">
                      {formatDate(r.deleted_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={pending}
                        onClick={() => restore(r.id)}
                      >
                        <RotateCcw className="size-4" />
                        Restore
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </>
  );
}
