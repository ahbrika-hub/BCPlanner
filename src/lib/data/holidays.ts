import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Tables } from "./types";

export type HolidayRow = Tables["public_holidays"]["Row"];

/** All holidays, soonest first. */
export async function listHolidays(): Promise<HolidayRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("public_holidays")
    .select("*")
    .order("holiday_date", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

/**
 * The holiday DATES (YYYY-MM-DD) within an inclusive [from, to] range — the input
 * the central working-day helper subtracts from capacity. RLS-scoped read
 * (public_holidays_select = all authenticated).
 */
export async function listHolidayDates(
  from: string,
  to: string,
): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("public_holidays")
    .select("holiday_date")
    .gte("holiday_date", from)
    .lte("holiday_date", to);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => r.holiday_date);
}

export async function createHoliday(
  input: Tables["public_holidays"]["Insert"],
): Promise<HolidayRow> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("public_holidays")
    .insert(input)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateHoliday(
  id: string,
  patch: Tables["public_holidays"]["Update"],
): Promise<HolidayRow> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("public_holidays")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteHoliday(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("public_holidays")
    .delete()
    .eq("id", id);
  if (error) throw new Error(error.message);
}
