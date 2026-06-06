import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Tables } from "./types";

export type AuditLogWithActor = Tables["audit_logs"]["Row"] & {
  actor: { id: string; full_name: string } | null;
};

export type AuditFilters = {
  entity_type?: string;
  action?: string;
  actor_id?: string;
  from?: string;
  to?: string;
};

export async function listAuditLogs(
  filters: AuditFilters = {},
  limit = 50,
  offset = 0,
): Promise<{ rows: AuditLogWithActor[]; total: number }> {
  const supabase = await createClient();
  let q = supabase
    .from("audit_logs")
    .select("*, actor:profiles!audit_logs_actor_id_fkey(id, full_name)", {
      count: "exact",
    })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (filters.entity_type) q = q.eq("entity_type", filters.entity_type);
  if (filters.action) q = q.eq("action", filters.action);
  if (filters.actor_id) q = q.eq("actor_id", filters.actor_id);
  if (filters.from) q = q.gte("created_at", filters.from);
  if (filters.to) q = q.lte("created_at", `${filters.to}T23:59:59`);

  const { data, error, count } = await q;
  if (error) throw new Error(error.message);
  return {
    rows: (data ?? []) as unknown as AuditLogWithActor[],
    total: count ?? 0,
  };
}
