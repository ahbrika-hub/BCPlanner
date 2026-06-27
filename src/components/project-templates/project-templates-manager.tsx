"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { z } from "zod";

import { projectTemplateSchema } from "@/lib/validations";
import {
  createProjectTemplateAction,
  updateProjectTemplateAction,
  setProjectTemplateActiveAction,
} from "@/lib/actions/project-templates";
import type { ProjectTemplateWithTasks } from "@/lib/data/project-templates";
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

type FormValues = z.input<typeof projectTemplateSchema>;

const EMPTY_TASK = { title: "", priority: "medium" as const };

function TemplateDialog({
  businessLines,
  template,
  trigger,
}: {
  businessLines: BusinessLineRow[];
  template?: ProjectTemplateWithTasks;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const isEdit = !!template;

  const defaults: FormValues = {
    name: template?.name ?? "",
    description: template?.description ?? undefined,
    tasks:
      template?.tasks.map((t) => ({
        title: t.title,
        description: t.description ?? undefined,
        priority: t.priority ?? undefined,
        business_line_id: t.business_line_id ?? undefined,
        estimated_effort_hours: t.estimated_effort_hours ?? undefined,
      })) ?? [EMPTY_TASK],
  };

  const {
    register,
    handleSubmit,
    control,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(projectTemplateSchema),
    defaultValues: defaults,
  });
  const { fields, append, remove } = useFieldArray({ control, name: "tasks" });

  const onOpenChange = (next: boolean) => {
    if (next) reset(defaults);
    setOpen(next);
  };

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      const res = isEdit
        ? await updateProjectTemplateAction(template.id, values)
        : await createProjectTemplateAction(values);
      if (res.ok) {
        toast.success(isEdit ? "Template updated" : "Template created");
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
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit project template" : "New project template"}
          </DialogTitle>
          <DialogDescription>
            A reusable project recipe. Its tasks are generated through the normal
            create-task path when a project is made from this template.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Template name</Label>
            <Input id="name" {...register("name")} />
            {errors.name && (
              <p className="text-destructive text-xs">{errors.name.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" rows={2} {...register("description")} />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Tasks ({fields.length})</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => append({ ...EMPTY_TASK })}
              >
                <Plus className="size-4" />
                Add task
              </Button>
            </div>
            {errors.tasks?.message && (
              <p className="text-destructive text-xs">
                {errors.tasks.message}
              </p>
            )}
            <div className="space-y-3">
              {fields.map((field, i) => (
                <div key={field.id} className="rounded-md border p-3">
                  <div className="mb-2 flex items-start gap-2">
                    <div className="flex-1 space-y-1">
                      <Input
                        placeholder="Task title"
                        {...register(`tasks.${i}.title` as const)}
                      />
                      {errors.tasks?.[i]?.title && (
                        <p className="text-destructive text-xs">
                          {errors.tasks[i]?.title?.message}
                        </p>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={fields.length <= 1}
                      onClick={() => remove(i)}
                      aria-label="Remove task"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <Select
                      defaultValue={defaults.tasks[i]?.priority ?? "medium"}
                      onValueChange={(v) =>
                        setValue(
                          `tasks.${i}.priority` as const,
                          v as FormValues["tasks"][number]["priority"],
                        )
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Priority" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select
                      defaultValue={defaults.tasks[i]?.business_line_id}
                      onValueChange={(v) =>
                        setValue(`tasks.${i}.business_line_id` as const, v)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Business line" />
                      </SelectTrigger>
                      <SelectContent>
                        {businessLines.map((bl) => (
                          <SelectItem key={bl.id} value={bl.id}>
                            {bl.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      step="0.5"
                      min="0"
                      placeholder="Est. hrs"
                      {...register(
                        `tasks.${i}.estimated_effort_hours` as const,
                        { valueAsNumber: true },
                      )}
                    />
                  </div>
                </div>
              ))}
            </div>
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

export function ProjectTemplatesManager({
  rows,
  businessLines,
}: {
  rows: ProjectTemplateWithTasks[];
  businessLines: BusinessLineRow[];
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const toggleActive = (id: string, isActive: boolean) =>
    startTransition(async () => {
      const res = await setProjectTemplateActiveAction(id, isActive);
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
          title="No project templates"
          description="Create a template to generate a standard task set for new projects."
        />
      ) : (
        <div className="rounded-lg border">
          <Table stickyFirstColumn>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Tasks</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((tpl) => (
                <TableRow key={tpl.id}>
                  <TableCell className="font-medium">{tpl.name}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {tpl.tasks.length}
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
