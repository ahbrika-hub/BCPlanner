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

/** Department/project classifier — distinct from the free-text `category` sentinel. */
export const taskCategorySchema = z.enum(["department", "project"]);

const taskFields = z.object({
  title: z.string().min(3).max(255),
  description: z.string().optional(),
  category: z.string().optional(),
  task_category: taskCategorySchema.default("department"),
  project_id: z.uuid().optional(),
  business_line_id: z.uuid().optional(),
  assignee_id: z.uuid().optional(),
  priority: taskPrioritySchema.default("medium"),
  start_date: z.iso.date().optional(),
  due_date: z.iso.date().optional(),
  estimated_effort_hours: z.number().positive().optional(),
  sharepoint_url: sharepointUrlSchema,
});

// A project must be picked iff the task is categorised as a project.
const projectLinkValid = (d: {
  task_category?: "department" | "project";
  project_id?: string;
}) => d.task_category !== "project" || !!d.project_id;
const projectLinkRefinement = {
  message: "Select a project for project-type tasks.",
  path: ["project_id"],
};

export const createTaskSchema = taskFields.refine(
  projectLinkValid,
  projectLinkRefinement,
);

export const updateTaskSchema = taskFields
  .partial()
  .extend({
    latest_action: z.string().optional(),
    next_action: z.string().optional(),
    challenges_blockers: z.string().optional(),
    required_support: z.string().optional(),
    closure_summary: z.string().optional(),
    quality_rating: z.number().int().min(1).max(5).optional(),
  })
  .refine(projectLinkValid, projectLinkRefinement);

export const transitionTaskSchema = z.object({
  status: taskStatusSchema,
  reason: z.string().optional(),
});

export type TaskStatus = z.infer<typeof taskStatusSchema>;
export type TaskPriority = z.infer<typeof taskPrioritySchema>;
export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type TransitionTaskInput = z.infer<typeof transitionTaskSchema>;
