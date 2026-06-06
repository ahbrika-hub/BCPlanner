import { z } from "zod";

export const createEvaluationSchema = z.object({
  employee_id: z.uuid(),
  period: z.string().regex(/^\d{4}-Q[1-4]$/, "Use a period like 2026-Q2"),
  evaluation_notes: z.string().max(2000).optional(),
});

export type CreateEvaluationInput = z.infer<typeof createEvaluationSchema>;
