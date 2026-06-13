"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { z } from "zod";

import { taskTemplateSchema } from "@/lib/validations";
import {
  createTaskTemplateAction,
  updateTaskTemplateAction,
  setTaskTemplateActiveAction,
} from "@/lib/actions/task-templates";
import type { TaskTemplateWithBusinessLine } from "@/lib/data/task-templates";
import type { BusinessLineRow } from "@/lib/data/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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

type FormValues = z.input<typeof taskTemplateSchema>;

function TemplateDialog({
  businessLines,
  template,
  trigger,
}: {
  businessLines: BusinessLineRow[];
  template?: TaskTemplateWithBusinessLine;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const isEdit = !!template;

  const defaults: Partial<FormValues> = {
    name: template?.name,
    title: template?.title ?? undefined,
    description: template?.description ?? undefined,
    priority: template?.priority ?? undefined,
    business_line_id: template?.business_line_id ?? undefined,
    estimated_effort_hours: template?.estimated_effort_hours ?? undefined,
  };

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(taskTemplateSchema),
    defaultValues: defaults,
  });

  const onOpenChange = (next: boolean) => {
    if (next) reset(defaults);
    setOpen(next);
  };

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      const cleaned = Object.fromEntries(
        Object.entries(values).filter(([, v]) => v !== "" && v !== undefined),
      );
      const res = isEdit
        ? await updateTaskTemplateAction(template.id, cleaned)
        : await createTaskTemplateAction(cleaned);
      if (res.ok) {
        toast.success(isEdit ? "Template updated" : "Template created");
        if (!isEdit) reset({});
        setOpen(false);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit template" : "New template"}</DialogTitle>
          <DialogDescription>
            Defaults pre-fill the new-task form; tasks are still created normally.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-4"
          key={open ? "open" : "closed"}
        >
          <div className="space-y-2">
            <Label htmlFor="name">Template name</Label>
            <Input id="name" {...register("name")} />
            {errors.name && (
              <p className="text-destructive text-xs">{errors.name.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="title">Default task title</Label>
            <Input id="title" {...register("title")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Default description</Label>
            <Textarea id="description" rows={3} {...register("description")} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select
                defaultValue={defaults.priority}
                onValueChange={(v) =>
                  setValue("priority", v as FormValues["priority"])
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="hours">Est. hrs</Label>
              <Input
                id="hours"
                type="number"
                step="0.5"
                min="0"
                {...register("estimated_effort_hours", { valueAsNumber: true })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Business line</Label>
            <Select
              defaultValue={defaults.business_line_id}
              onValueChange={(v) => setValue("business_line_id", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="None" />
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
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              {isEdit ? "Save changes" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function TemplatesManager({
  rows,
  businessLines,
}: {
  rows: TaskTemplateWithBusinessLine[];
  businessLines: BusinessLineRow[];
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const toggleActive = (id: string, isActive: boolean) =>
    startTransition(async () => {
      const res = await setTaskTemplateActiveAction(id, isActive);
      if (res.ok) {
        toast.success(isActive ? "Template activated" : "Template deactivated");
        router.refresh();
      } else {
        toast.error(res.error ?? "Failed");
      }
    });

  return (
    <>
      <div className="mb-4 flex justify-end">
        <TemplateDialog
          businessLines={businessLines}
          trigger={
            <Button>
              <Plus className="size-4" />
              New template
            </Button>
          }
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="No templates"
          description="Create a template to speed up task creation."
        />
      ) : (
        <div className="rounded-lg border">
          <Table stickyFirstColumn>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Default title</TableHead>
                <TableHead>Business line</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((tpl) => (
                <TableRow key={tpl.id}>
                  <TableCell className="font-medium">{tpl.name}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {tpl.title ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {tpl.business_line?.name ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={tpl.is_active ? "default" : "secondary"}>
                      {tpl.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <TemplateDialog
                      businessLines={businessLines}
                      template={tpl}
                      trigger={
                        <Button variant="ghost" size="sm">
                          Edit
                        </Button>
                      }
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={pending}
                      onClick={() => toggleActive(tpl.id, !tpl.is_active)}
                    >
                      {tpl.is_active ? "Deactivate" : "Activate"}
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
