import { z } from "zod";

export const createProjectSchema = z.object({
  name: z.string().min(2).max(255),
  business_line_id: z.uuid().optional(),
});

export const setProjectActiveSchema = z.object({
  is_active: z.boolean(),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
