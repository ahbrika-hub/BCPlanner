import { z } from "zod";

export const addTaskUpdateSchema = z.object({
  progress_percentage: z.number().int().min(0).max(100),
  status_update_comment: z.string().optional(),
  latest_action: z.string().optional(),
  next_action: z.string().optional(),
  challenges_blockers: z.string().optional(),
  required_support: z.string().optional(),
  expected_completion_date: z.iso.date().optional(),
});

export type AddTaskUpdateInput = z.infer<typeof addTaskUpdateSchema>;
