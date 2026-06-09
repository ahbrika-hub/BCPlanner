"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { z } from "zod";

import { createTaskSchema } from "@/lib/validations";
import { createTaskAction } from "@/lib/actions/tasks";
import type { BusinessLineRow, AssignableUser } from "@/lib/data/types";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type FormValues = z.input<typeof createTaskSchema>;

export function NewTaskDialog({
  businessLines,
  users,
  projects,
}: {
  businessLines: BusinessLineRow[];
  users: AssignableUser[];
  projects: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [taskCategory, setTaskCategory] = useState<"department" | "project">(
    "department",
  );
  const router = useRouter();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(createTaskSchema),
    defaultValues: { priority: "medium", task_category: "department" },
  });

  const onTaskCategoryChange = (v: "department" | "project") => {
    setTaskCategory(v);
    setValue("task_category", v);
    // Department tasks never carry a project; clear it when switching away.
    if (v !== "project") setValue("project_id", undefined);
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
        reset({ priority: "medium", task_category: "department" });
        setTaskCategory("department");
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
            <Textarea id="description" rows={3} {...register("description")} />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Input id="category" {...register("category")} />
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select
                defaultValue="medium"
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
              <Label>Task Category</Label>
              <Select
                defaultValue="department"
                onValueChange={(v) =>
                  onTaskCategoryChange(v as "department" | "project")
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="department">Department</SelectItem>
                  <SelectItem value="project">Project</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {taskCategory === "project" && (
              <div className="space-y-2">
                <Label>Project</Label>
                <Select onValueChange={(v) => setValue("project_id", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a project…" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.length === 0 ? (
                      <div className="text-muted-foreground px-2 py-1.5 text-sm">
                        No active projects
                      </div>
                    ) : (
                      projects.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {errors.project_id && (
                  <p className="text-destructive text-xs">
                    {errors.project_id.message}
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Business Line</Label>
              <Select onValueChange={(v) => setValue("business_line_id", v)}>
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
              <Select onValueChange={(v) => setValue("assignee_id", v)}>
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

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="start_date">Start</Label>
              <Input id="start_date" type="date" {...register("start_date")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="due_date">Due</Label>
              <Input id="due_date" type="date" {...register("due_date")} />
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
            <Label htmlFor="sharepoint_url">SharePoint link (optional)</Label>
            <Input
              id="sharepoint_url"
              type="url"
              inputMode="url"
              placeholder="https://…"
              {...register("sharepoint_url")}
            />
            {errors.sharepoint_url && (
              <p className="text-destructive text-xs">
                {errors.sharepoint_url.message}
              </p>
            )}
          </div>

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
