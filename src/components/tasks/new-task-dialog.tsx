"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { createTaskSchema } from "@/lib/validations";
import { createTaskAction } from "@/lib/actions/tasks";
import type { BusinessLineRow, AssignableUser } from "@/lib/data/types";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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
  TaskFormFields,
  type TaskFormValues,
} from "@/components/tasks/task-form-fields";

type FormValues = TaskFormValues;

/** A template's mappable defaults, as passed to the create form. */
export type NewTaskTemplate = {
  id: string;
  name: string;
  title: string | null;
  description: string | null;
  priority: "low" | "medium" | "high" | "critical" | null;
  business_line_id: string | null;
  estimated_effort_hours: number | null;
};

const CREATE_DEFAULTS: Partial<FormValues> = {
  priority: "medium",
  task_category: "department",
};

export function NewTaskDialog({
  businessLines,
  users,
  projects,
  templates = [],
}: {
  businessLines: BusinessLineRow[];
  users: AssignableUser[];
  projects: { id: string; name: string }[];
  templates?: NewTaskTemplate[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  // Bumped on a successful create or template pick to remount TaskFormFields,
  // resetting its internal task-category state alongside the react-hook-form
  // reset() and re-seeding the uncontrolled Select defaults.
  const [formKey, setFormKey] = useState(0);
  const [templateId, setTemplateId] = useState("");
  const [seeded, setSeeded] = useState<Partial<FormValues>>(CREATE_DEFAULTS);
  const router = useRouter();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(createTaskSchema),
    defaultValues: CREATE_DEFAULTS,
  });

  // Selecting a template only supplies DEFAULTS — submission still goes through
  // the unchanged create-task action. Department/project, dates, and assignee
  // stay user-chosen.
  const applyTemplate = (id: string) => {
    setTemplateId(id);
    const tpl = templates.find((t) => t.id === id);
    const next: Partial<FormValues> = {
      ...CREATE_DEFAULTS,
      priority: tpl?.priority ?? "medium",
      title: tpl?.title ?? undefined,
      description: tpl?.description ?? undefined,
      business_line_id: tpl?.business_line_id ?? undefined,
      estimated_effort_hours: tpl?.estimated_effort_hours ?? undefined,
    };
    reset(next);
    setSeeded(next);
    setFormKey((k) => k + 1);
  };

  const onSubmit = (values: FormValues) => {
    startTransition(async () => {
      // strip empty strings so optional fields stay undefined
      const cleaned = Object.fromEntries(
        Object.entries(values).filter(([, v]) => v !== "" && v !== undefined),
      );
      const res = await createTaskAction(cleaned);
      if (res.ok) {
        toast.success("Task created");
        reset(CREATE_DEFAULTS);
        setSeeded(CREATE_DEFAULTS);
        setTemplateId("");
        setFormKey((k) => k + 1);
        setOpen(false);
        router.refresh();
        if (res.id) router.push(`/tasks/${res.id}`);
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" />
          New Task
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New Task</DialogTitle>
          <DialogDescription>
            Create a task. Employee-created tasks go to approval first.
          </DialogDescription>
        </DialogHeader>
        {templates.length > 0 && (
          <div className="space-y-2">
            <Label>Start from a template (optional)</Label>
            <Select value={templateId} onValueChange={applyTemplate}>
              <SelectTrigger>
                <SelectValue placeholder="No template" />
              </SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <TaskFormFields
            key={formKey}
            mode="create"
            register={register}
            setValue={setValue}
            errors={errors}
            businessLines={businessLines}
            users={users}
            projects={projects}
            defaults={seeded}
          />

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              Create Task
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
