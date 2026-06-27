import { z } from "zod";

const priority = z.enum(["low", "medium", "high", "critical"]);

/**
 * A single task definition inside a project template — the same default-field
 * shape task_templates uses, except `title` is required (a project recipe needs
 * concrete tasks). Generation maps these onto createTaskAction inputs.
 */
export const projectTemplateTaskSchema = z.object({
  // min 3 to match createTaskSchema, so every def passes the real creation path.
  title: z.string().trim().min(3, "Task title must be at least 3 characters.").max(255),
  description: z.string().optional(),
  priority: priority.optional(),
  business_line_id: z.uuid().optional(),
  estimated_effort_hours: z.number().positive().optional(),
});

export const projectTemplateSchema = z.object({
  name: z.string().trim().min(2).max(255),
  description: z.string().optional(),
  tasks: z
    .array(projectTemplateTaskSchema)
    .min(1, "Add at least one task.")
    .max(50, "A template can hold at most 50 tasks."),
});

/** Create a real project from a template (then generate its tasks). */
export const createProjectFromTemplateSchema = z.object({
  template_id: z.uuid(),
  name: z.string().trim().min(2).max(255),
  business_line_id: z.uuid().optional(),
});

export type ProjectTemplateInput = z.infer<typeof projectTemplateSchema>;
export type ProjectTemplateTaskInput = z.infer<
  typeof projectTemplateTaskSchema
>;
export type CreateProjectFromTemplateInput = z.infer<
  typeof createProjectFromTemplateSchema
>;
