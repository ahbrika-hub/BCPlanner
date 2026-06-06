import { z } from "zod";

export const userRoleSchema = z.enum([
  "admin",
  "section_head",
  "employee",
  "ceo",
]);

export const updateUserSchema = z.object({
  full_name: z.string().min(2).max(255).optional(),
  job_title: z.string().max(255).optional(),
  role: userRoleSchema.optional(),
  department_id: z.uuid().nullable().optional(),
  is_active: z.boolean().optional(),
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;
