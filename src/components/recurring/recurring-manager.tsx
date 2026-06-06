"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Loader2, Play, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { z } from "zod";

import { createRecurringSchema } from "@/lib/validations";
import {
  createRecurringAction,
  updateRecurringAction,
  deleteRecurringAction,
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

type FormValues = z.input<typeof createRecurringSchema>;

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
          estimated_effort_hours: existing.estimated_effort_hours ?? undefined,
          is_active: existing.is_active,
        }
      : { priority: "medium", frequency: "weekly", is_active: true },
  });

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
          <div className="grid grid-cols-2 gap-3">
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
          <div className="grid grid-cols-2 gap-3">
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
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="start_date">Start date</Label>
              <Input id="start_date" type="date" {...register("start_date")} />
              {errors.start_date && (
                <p className="text-destructive text-xs">Required</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="hours">Est. hours</Label>
              <Input
                id="hours"
                type="number"
                step="0.5"
                min="0"
                {...register("estimated_effort_hours", { valueAsNumber: true })}
              />
            </div>
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
  businessLines,
  users,
}: {
  rows: RecurringWithRelations[];
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

  return (
    <>
      <div className="mb-4 flex justify-end gap-2">
        <Button
          variant="outline"
          disabled={pending}
          onClick={() => act(generateNowAction, "Done")}
        >
          <Play className="size-4" />
          Generate Due Tasks Now
        </Button>
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
          <Table>
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
                      onClick={() =>
                        act(() => deleteRecurringAction(r.id), "Deleted")
                      }
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
    </>
  );
}
