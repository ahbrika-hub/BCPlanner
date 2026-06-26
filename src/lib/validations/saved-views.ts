import { z } from "zod";

import { savedViewConfigSchema } from "@/lib/tasks/saved-view-config";

const nameField = z
  .string()
  .trim()
  .min(1, "Name is required.")
  .max(80, "Name must be 80 characters or fewer.");

export const createSavedViewSchema = z.object({
  name: nameField,
  config: savedViewConfigSchema,
});

export const renameSavedViewSchema = z.object({
  id: z.uuid(),
  name: nameField,
});

export const updateSavedViewConfigSchema = z.object({
  id: z.uuid(),
  config: savedViewConfigSchema,
});

export type CreateSavedViewInput = z.infer<typeof createSavedViewSchema>;
export type RenameSavedViewInput = z.infer<typeof renameSavedViewSchema>;
export type UpdateSavedViewConfigInput = z.infer<
  typeof updateSavedViewConfigSchema
>;
