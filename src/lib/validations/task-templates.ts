import { z } from "zod";

import { taskPrioritySchema } from "./tasks";

/**
 * A template carries ONLY defaults that map to real create-task fields
 * (title, description, priority, business line, estimated effort). All optional
 * except the template's own name.
 */
export const taskTemplateSchema = z.object({
  name: z.string().min(2).max(255),
  title: z.string().max(255).optional(),
  description: z.string().optional(),
  priority: taskPrioritySchema.optional(),
  business_line_id: z.uuid().optional(),
  estimated_effort_hours: z.number().positive().optional(),
});

export type TaskTemplateInput = z.infer<typeof taskTemplateSchema>;
