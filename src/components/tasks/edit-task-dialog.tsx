"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { createTaskSchema } from "@/lib/validations";
import { updateTaskAction } from "@/lib/actions/tasks";
import type { BusinessLineRow } from "@/lib/data/types";
import { Button } from "@/components/ui/button";
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
  TaskFormFields,
  type TaskFormValues,
} from "@/components/tasks/task-form-fields";

/** Current descriptive values used to pre-populate the edit form. */
export type EditableTask = {
  id: string;
  title: string;
  description: string | null;
  priority: "low" | "medium" | "high" | "critical";
  due_date: string | null;
  business_line_id: string | null;
  sharepoint_url: string | null;
  task_category: "department" | "project";
  project_id: string | null;
};

/**
 * Edit affordance shown in the task detail/modal to eligible roles. Reuses the
 * create form (via TaskFormFields, mode="edit") pre-populated with the task's
 * current values. Eligibility is enforced server-side in updateTaskAction
 * regardless of whether this button is rendered.
 */
export function EditTaskDialog({
  task,
  businessLines,
  projects,
}: {
  task: EditableTask;
  businessLines: BusinessLineRow[];
  projects: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const defaults: Partial<TaskFormValues> = {
    title: task.title,
    description: task.description ?? undefined,
    priority: task.priority,
    due_date: task.due_date ?? undefined,
    business_line_id: task.business_line_id ?? undefined,
    sharepoint_url: task.sharepoint_url ?? undefined,
    task_category: task.task_category,
    project_id: task.project_id ?? undefined,
  };

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<TaskFormValues>({
    resolver: zodResolver(createTaskSchema),
    defaultValues: defaults,
  });

  const onOpenChange = (next: boolean) => {
    // Re-seed the form from the task's current values each time it opens.
    if (next) reset(defaults);
    setOpen(next);
  };

  const onSubmit = (values: TaskFormValues) => {
    startTransition(async () => {
      // strip empty strings so optional fields stay undefined
      const cleaned = Object.fromEntries(
        Object.entries(values).filter(([, v]) => v !== "" && v !== undefined),
      );
      const res = await updateTaskAction(task.id, cleaned);
      if (res.ok) {
        toast.success("Task updated");
        setOpen(false);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil className="size-4" />
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Task</DialogTitle>
          <DialogDescription>
            Update the task&rsquo;s descriptive details. Status and assignee
            changes use their own actions.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <TaskFormFields
            key={open ? "open" : "closed"}
            mode="edit"
            register={register}
            setValue={setValue}
            errors={errors}
            businessLines={businessLines}
            projects={projects}
            defaults={defaults}
          />

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
