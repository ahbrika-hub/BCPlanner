"use client";

import { useState } from "react";
import type {
  FieldErrors,
  UseFormRegister,
  UseFormSetValue,
} from "react-hook-form";
import type { z } from "zod";

import type { createTaskSchema } from "@/lib/validations";
import type { BusinessLineRow, AssignableUser } from "@/lib/data/types";
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

export type TaskFormValues = z.input<typeof createTaskSchema>;

/**
 * The descriptive-field inputs shared by the create dialog and the edit dialog,
 * so the form is reused rather than duplicated. `mode` hides the create-only
 * fields (assignee, start date, effort hours, and the free-text category
 * sentinel) in edit mode — editing touches descriptive metadata only: title,
 * description, priority, due date, business line, SharePoint link, and the
 * task_category + project pairing.
 */
export function TaskFormFields({
  mode,
  register,
  setValue,
  errors,
  businessLines,
  users = [],
  projects,
  defaults,
}: {
  mode: "create" | "edit";
  register: UseFormRegister<TaskFormValues>;
  setValue: UseFormSetValue<TaskFormValues>;
  errors: FieldErrors<TaskFormValues>;
  businessLines: BusinessLineRow[];
  users?: AssignableUser[];
  projects: { id: string; name: string }[];
  defaults?: Partial<TaskFormValues>;
}) {
  const [taskCategory, setTaskCategory] = useState<"department" | "project">(
    defaults?.task_category ?? "department",
  );

  const onTaskCategoryChange = (v: "department" | "project") => {
    setTaskCategory(v);
    setValue("task_category", v);
    // Department tasks never carry a project; clear it when switching away.
    if (v !== "project") setValue("project_id", undefined);
  };

  return (
    <>
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
        {mode === "create" && (
          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Input id="category" {...register("category")} />
          </div>
        )}
        <div className="space-y-2">
          <Label>Priority</Label>
          <Select
            defaultValue={defaults?.priority ?? "medium"}
            onValueChange={(v) =>
              setValue("priority", v as TaskFormValues["priority"])
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
            defaultValue={defaults?.task_category ?? "department"}
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
            <Select
              defaultValue={defaults?.project_id}
              onValueChange={(v) => setValue("project_id", v)}
            >
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
          <Select
            defaultValue={defaults?.business_line_id}
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
        {mode === "create" && (
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
        )}
      </div>

      {mode === "create" ? (
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
      ) : (
        <div className="space-y-2">
          <Label htmlFor="due_date">Due</Label>
          <Input id="due_date" type="date" {...register("due_date")} />
        </div>
      )}

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
    </>
  );
}
