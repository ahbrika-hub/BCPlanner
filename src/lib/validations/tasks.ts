import { z } from "zod";

/** The 12 task lifecycle statuses. */
export const taskStatusSchema = z.enum([
  "draft",
  "pending_approval",
  "approved",
  "assigned",
  "in_progress",
  "pending_update",
  "pending_review",
  "completed",
  "rejected",
  "returned_for_modification",
  "cancelled",
  "reopened",
]);

export const taskPrioritySchema = z.enum(["low", "medium", "high", "critical"]);

/** Optional SharePoint link — must be a valid https URL (rejects http/javascript/malformed). */
function isHttpsUrl(v: string): boolean {
  try {
    return new URL(v).protocol === "https:";
  } catch {
    return false;
  }
}
export const sharepointUrlSchema = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z
    .string()
    .trim()
    .refine(isHttpsUrl, {
      message: "SharePoint link must be a valid https URL.",
    })
    .optional(),
);

export const createTaskSchema = z.object({
  title: z.string().min(3).max(255),
  description: z.string().optional(),
  category: z.string().optional(),
  business_line_id: z.uuid().optional(),
  assignee_id: z.uuid().optional(),
  priority: taskPrioritySchema.default("medium"),
  start_date: z.iso.date().optional(),
  due_date: z.iso.date().optional(),
  estimated_effort_hours: z.number().positive().optional(),
  sharepoint_url: sharepointUrlSchema,
});

export const updateTaskSchema = createTaskSchema.partial().extend({
  latest_action: z.string().optional(),
  next_action: z.string().optional(),
  challenges_blockers: z.string().optional(),
  required_support: z.string().optional(),
  closure_summary: z.string().optional(),
  quality_rating: z.number().int().min(1).max(5).optional(),
});

export const transitionTaskSchema = z.object({
  status: taskStatusSchema,
  reason: z.string().optional(),
});

export type TaskStatus = z.infer<typeof taskStatusSchema>;
export type TaskPriority = z.infer<typeof taskPrioritySchema>;
export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type TransitionTaskInput = z.infer<typeof transitionTaskSchema>;
