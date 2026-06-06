import { z } from "zod";

// role / department_id / is_active are intentionally excluded — those are
// admin-only fields and must not be self-editable.
export const updateProfileSchema = z.object({
  full_name: z.string().min(2).max(255).optional(),
  job_title: z.string().max(255).optional(),
  avatar_url: z.url().optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
