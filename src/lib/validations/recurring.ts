import { z } from "zod";

import { taskPrioritySchema } from "./tasks";

export const recurrenceFreqSchema = z.enum(["weekly", "monthly", "quarterly"]);

export const createRecurringSchema = z.object({
  title: z.string().min(3).max(255),
  description: z.string().optional(),
  category: z.string().optional(),
  business_line_id: z.uuid().optional(),
  assignee_id: z.uuid().optional(),
  priority: taskPrioritySchema.default("medium"),
  frequency: recurrenceFreqSchema,
  start_date: z.iso.date(),
  next_generation_date: z.iso.date().optional(),
  estimated_effort_hours: z.number().positive().optional(),
  is_active: z.boolean().default(true),
});

export const updateRecurringSchema = createRecurringSchema.partial();

export type CreateRecurringInput = z.infer<typeof createRecurringSchema>;
