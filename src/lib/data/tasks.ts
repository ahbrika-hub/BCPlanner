import "server-only";

import { createClient } from "@/lib/supabase/server";
import { OVERDUE_EXCLUDED_STATUSES, todayDateString } from "@/lib/tasks/overdue";
import type {
  Tables,
  TaskWithRelations,
  TaskStatus,
  TaskPriority,
} from "./types";

const TASK_SELECT = `
  *,
  assignee:profiles!tasks_assignee_id_fkey(id, full_name),
  creator:profiles!tasks_created_by_fkey(id, full_name),
  approver:profiles!tasks_approved_by_fkey(id, full_name),
  business_line:business_lines!tasks_business_line_id_fkey(id, name),
  project:projects!tasks_project_id_fkey(id, name)
`;

export type TaskFilters = {
  status?: TaskStatus[];
  priority?: TaskPriority;
  assignee_id?: string;
  business_line_id?: string;
  search?: string;
  /** Derived overdue filter — see @/lib/tasks/overdue for the canonical rule. */
  overdue?: boolean;
};

export async function listTasks(
  filters: TaskFilters = {},
): Promise<TaskWithRelations[]> {
  const supabase = await createClient();
  let query = supabase
    .from("tasks")
    .select(TASK_SELECT)
    .order("created_at", { ascending: false });

  if (filters.status && filters.status.length > 0) {
    query = query.in("status", filters.status);
  }
  if (filters.priority) query = query.eq("priority", filters.priority);
  if (filters.assignee_id) query = query.eq("assignee_id", filters.assignee_id);
  if (filters.business_line_id)
    query = query.eq("business_line_id", filters.business_line_id);

  if (filters.search) {
    // FTS over title+task_no+description (search_vector, 'simple' config) OR a
    // trigram substring match on the hyphenated task number. Strip PostgREST
    // `or()` control characters so a stray comma/paren can't alter the filter.
    const term = filters.search
      .trim()
      .replace(/[(),*%]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 100);
    if (term) {
      query = query.or(
        `search_vector.wfts(simple).${term},task_no.ilike.*${term}*`,
      );
    }
  }

  if (filters.overdue) {
    // Canonical overdue rule, mirrored from @/lib/tasks/overdue: a due date in
    // the past and a non-terminal status. Runs in the RLS-scoped query, so a
    // user only ever sees their own overdue rows.
    query = query
      .not("due_date", "is", null)
      .lt("due_date", todayDateString())
      .not("status", "in", `(${OVERDUE_EXCLUDED_STATUSES.join(",")})`);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as TaskWithRelations[];
}

export async function getTask(id: string): Promise<TaskWithRelations | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tasks")
    .select(TASK_SELECT)
    .eq("id", id)
    .maybeSingle();
  return (data as unknown as TaskWithRelations) ?? null;
}

export async function createTask(
  input: Tables["tasks"]["Insert"],
): Promise<Tables["tasks"]["Row"]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .insert(input)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateTask(
  id: string,
  patch: Tables["tasks"]["Update"],
): Promise<Tables["tasks"]["Row"]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

/**
 * Updates status plus any side-effect columns. The DB transition guard rejects
 * illegal transitions — its message is surfaced to the caller.
 */
export async function transitionTask(
  id: string,
  newStatus: TaskStatus,
  sideEffects: Tables["tasks"]["Update"] = {},
): Promise<Tables["tasks"]["Row"]> {
  return updateTask(id, { ...sideEffects, status: newStatus });
}
