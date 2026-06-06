import { z } from "zod";

/** A batch of key/value settings updates. */
export const updateSettingsSchema = z.object({
  settings: z.array(
    z.object({
      key: z.string().min(1),
      value: z.string(),
    }),
  ),
});

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
