import { z } from "zod";

/**
 * Adding a dependency: the blocked task (`task_id`) depends on the blocker
 * (`depends_on_task_id`). Self-dependency is rejected here (and again by the DB
 * CHECK + cycle trigger). Transitive cycles are rejected by the DB trigger.
 */
export const addDependencySchema = z
  .object({
    task_id: z.uuid(),
    depends_on_task_id: z.uuid(),
  })
  .refine((d) => d.task_id !== d.depends_on_task_id, {
    message: "A task cannot depend on itself.",
    path: ["depends_on_task_id"],
  });

export type AddDependencyInput = z.infer<typeof addDependencySchema>;
