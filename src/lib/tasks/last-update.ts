// Pure selection of a task's most recent committed progress update. task_updates
// is append-only/immutable; this only READS the latest row (by created_at).

export type LastUpdate = {
  progress_percentage: number;
  status_update_comment: string | null;
  created_at: string;
  updater_name: string | null;
};

type UpdateLike = {
  progress_percentage: number;
  status_update_comment: string | null;
  created_at: string;
  updater?: { full_name: string | null } | null;
};

/**
 * Most recent update by `created_at` (not relying on input order), mapped to the
 * read-only "Last update" shape. Returns null when there are no updates yet.
 */
export function pickLatestUpdate(
  updates: UpdateLike[] | null | undefined,
): LastUpdate | null {
  if (!updates || updates.length === 0) return null;
  const latest = updates.reduce((a, b) => (b.created_at > a.created_at ? b : a));
  return {
    progress_percentage: latest.progress_percentage,
    status_update_comment: latest.status_update_comment,
    created_at: latest.created_at,
    updater_name: latest.updater?.full_name ?? null,
  };
}
