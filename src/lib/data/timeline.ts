import "server-only";

import { createClient } from "@/lib/supabase/server";
import { TASK_STATUS_LABELS, asTaskStatus } from "@/lib/tasks/status";

/**
 * Unified, RLS-scoped task activity timeline.
 *
 * Reads the four existing history sources for a single task under the caller's
 * SESSION client (NOT service-role), so each table's own RLS applies: a viewer
 * only ever receives rows they are allowed to see. In particular audit_logs is
 * gated by authorize('audit.read') — held by admin/section_head only — so a ceo
 * or employee simply gets zero audit-sourced (status-change) entries; nothing
 * leaks. The merge/sort/paginate step is the pure {@link paginateEntries}, so it
 * is unit-tested without a database.
 *
 * No history is written here; this is read-only aggregation. No migration.
 */

export type TimelineType = "status" | "update" | "comment" | "attachment";

export type TimelineEntry = {
  /** The source row id (a uuid) — globally unique across the merged stream. */
  id: string;
  type: TimelineType;
  actor: string | null;
  /** ISO timestamp (the source row's created_at). */
  timestamp: string;
  /** Human one-liner, e.g. "changed status". */
  summary: string;
  /** Optional secondary text, e.g. "Pending Approval → Approved" or a filename. */
  detail: string | null;
};

/** Opaque keyset cursor: the last entry of the previous page. */
export type TimelineCursor = { ts: string; id: string };

export type TimelinePage = {
  entries: TimelineEntry[];
  nextCursor: TimelineCursor | null;
};

const DEFAULT_PAGE_SIZE = 20;

// Total, stable ordering: newest-first by timestamp, then id descending (uuids
// are globally unique, so (timestamp, id) is a total order — no ties, which is
// what keeps pagination free of gaps/overlaps).
export function compareEntriesDesc(a: TimelineEntry, b: TimelineEntry): number {
  if (a.timestamp !== b.timestamp) return a.timestamp < b.timestamp ? 1 : -1;
  if (a.id !== b.id) return a.id < b.id ? 1 : -1;
  return 0;
}

// True when `e` falls strictly after `cursor` in the descending total order.
function isAfterCursor(e: TimelineEntry, cursor: TimelineCursor): boolean {
  if (e.timestamp !== cursor.ts) return e.timestamp < cursor.ts;
  return e.id < cursor.id;
}

/**
 * Pure merge → sort → page. `all` is the union of the per-source candidate
 * fetches (each bounded to pageSize+1 rows ≤ the cursor), which is always a
 * superset of the next page, so slicing here is exact.
 */
export function paginateEntries(
  all: TimelineEntry[],
  cursor: TimelineCursor | null,
  pageSize: number = DEFAULT_PAGE_SIZE,
): TimelinePage {
  const ordered = [...all].sort(compareEntriesDesc);
  const after = cursor
    ? ordered.filter((e) => isAfterCursor(e, cursor))
    : ordered;
  const entries = after.slice(0, pageSize);
  const last = entries[entries.length - 1];
  const nextCursor =
    after.length > pageSize && last
      ? { ts: last.timestamp, id: last.id }
      : null;
  return { entries, nextCursor };
}

function actorName(rel: unknown): string | null {
  const r = rel as { full_name: string | null } | null;
  return r?.full_name ?? null;
}

function statusLabel(raw: unknown): string {
  if (typeof raw !== "string") return "—";
  const s = asTaskStatus(raw);
  return s ? TASK_STATUS_LABELS[s] : raw;
}

/**
 * One page of the merged timeline, newest first. Fetches pageSize+1 candidates
 * from each source (bounded by the cursor) and merges them, so the DB never
 * returns the whole history at once.
 */
export async function getTaskTimeline(
  taskId: string,
  cursor: TimelineCursor | null = null,
  pageSize: number = DEFAULT_PAGE_SIZE,
): Promise<TimelinePage> {
  const supabase = await createClient();
  const cap = pageSize + 1;

  // Keyset bound: rows at or before the cursor timestamp (the precise
  // strictly-after filter is applied in paginateEntries). `.lte` must precede
  // the transform (`.order`/`.limit`) in the query builder.
  const updatesQ = supabase
    .from("task_updates")
    .select(
      "id, created_at, progress_percentage, status_update_comment, updater:profiles!task_updates_updated_by_fkey(full_name)",
    )
    .eq("task_id", taskId);
  const commentsQ = supabase
    .from("task_comments")
    .select(
      "id, created_at, comment_text, author:profiles!task_comments_author_id_fkey(full_name)",
    )
    .eq("task_id", taskId);
  const attachmentsQ = supabase
    .from("task_attachments")
    .select(
      "id, created_at, file_name, uploader:profiles!task_attachments_uploaded_by_fkey(full_name)",
    )
    .eq("task_id", taskId);
  // audit_logs RLS (authorize('audit.read')) yields zero rows for ceo/employee.
  const auditQ = supabase
    .from("audit_logs")
    .select(
      "id, created_at, action, before_data, after_data, actor:profiles!audit_logs_actor_id_fkey(full_name)",
    )
    .eq("entity_type", "task")
    .eq("entity_id", taskId);

  const [updates, comments, attachments, audit] = await Promise.all([
    (cursor ? updatesQ.lte("created_at", cursor.ts) : updatesQ)
      .order("created_at", { ascending: false })
      .limit(cap),
    (cursor ? commentsQ.lte("created_at", cursor.ts) : commentsQ)
      .order("created_at", { ascending: false })
      .limit(cap),
    (cursor ? attachmentsQ.lte("created_at", cursor.ts) : attachmentsQ)
      .order("created_at", { ascending: false })
      .limit(cap),
    (cursor ? auditQ.lte("created_at", cursor.ts) : auditQ)
      .order("created_at", { ascending: false })
      .limit(cap),
  ]);

  const entries: TimelineEntry[] = [];

  for (const u of updates.data ?? []) {
    entries.push({
      id: u.id,
      type: "update",
      actor: actorName(u.updater),
      timestamp: u.created_at,
      summary: "posted a progress update",
      detail:
        u.status_update_comment ??
        (u.progress_percentage != null
          ? `Progress ${u.progress_percentage}%`
          : null),
    });
  }
  for (const c of comments.data ?? []) {
    entries.push({
      id: c.id,
      type: "comment",
      actor: actorName(c.author),
      timestamp: c.created_at,
      summary: "commented",
      detail: c.comment_text ?? null,
    });
  }
  for (const a of attachments.data ?? []) {
    entries.push({
      id: a.id,
      type: "attachment",
      actor: actorName(a.uploader),
      timestamp: a.created_at,
      summary: "added an attachment",
      detail: a.file_name ?? null,
    });
  }
  for (const e of audit.data ?? []) {
    const before = (e.before_data as { status?: string } | null)?.status;
    const after = (e.after_data as { status?: string } | null)?.status;
    const isStatus = e.action === "task.status_changed";
    entries.push({
      id: e.id,
      type: "status",
      actor: actorName(e.actor),
      timestamp: e.created_at,
      summary: isStatus ? "changed status" : e.action,
      detail: isStatus
        ? `${statusLabel(before)} → ${statusLabel(after)}`
        : null,
    });
  }

  return paginateEntries(entries, cursor, pageSize);
}
