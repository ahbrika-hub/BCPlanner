import { z } from "zod";

export const createHolidaySchema = z.object({
  holiday_date: z.iso.date(),
  name: z.string().trim().min(1, "Name is required.").max(120),
});

export const updateHolidaySchema = z.object({
  id: z.uuid(),
  holiday_date: z.iso.date(),
  name: z.string().trim().min(1, "Name is required.").max(120),
});

export type CreateHolidayInput = z.infer<typeof createHolidaySchema>;
export type UpdateHolidayInput = z.infer<typeof updateHolidaySchema>;
