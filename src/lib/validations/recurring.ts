import { z } from "zod";

import { taskPrioritySchema } from "./tasks";

export const recurrenceFreqSchema = z.enum(["weekly", "monthly", "quarterly"]);

const recurringFields = z.object({
  title: z.string().min(3).max(255),
  description: z.string().optional(),
  category: z.string().optional(),
  business_line_id: z.uuid().optional(),
  assignee_id: z.uuid().optional(),
  priority: taskPrioritySchema.default("medium"),
  frequency: recurrenceFreqSchema,
  start_date: z.iso.date(),
  expected_end_date: z.iso.date().optional(),
  next_generation_date: z.iso.date().optional(),
  estimated_effort_hours: z.number().positive().optional(),
  is_active: z.boolean().default(true),
});

// Expected end date (when both are present) must be on or after the start date.
// ISO YYYY-MM-DD strings compare correctly lexicographically.
const endOnOrAfterStart = (d: {
  start_date?: string;
  expected_end_date?: string;
}) =>
  !d.start_date || !d.expected_end_date || d.expected_end_date >= d.start_date;

const endDateRefinement = {
  message: "Expected end date must be on or after the start date.",
  path: ["expected_end_date"],
};

export const createRecurringSchema = recurringFields.refine(
  endOnOrAfterStart,
  endDateRefinement,
);

export const updateRecurringSchema = recurringFields
  .partial()
  .refine(endOnOrAfterStart, endDateRefinement);

export type CreateRecurringInput = z.infer<typeof createRecurringSchema>;
