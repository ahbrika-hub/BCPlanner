import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Tables } from "./types";

export async function listDepartments(): Promise<
  Tables["departments"]["Row"][]
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("departments")
    .select("*")
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}
