-- Recurring task enhancements (additive only).
--   * expected_end_date: optional planned end date for the template.
--   * deleted_at: soft-delete marker. The delete path now sets deleted_at (and
--     is_active = false, so generate_due_recurring_tasks — which only processes
--     active templates — stops materialising the template) instead of a hard
--     DELETE; reads filter deleted_at IS NULL, and Restore clears it.
--
-- No RLS change: recurring_tasks_write is FOR ALL on authorize('recurring.manage'),
-- so the soft-delete UPDATE and restore are already permitted for the managing
-- roles. generate_due_recurring_tasks() is unchanged.

alter table public.recurring_tasks
  add column if not exists expected_end_date date;

alter table public.recurring_tasks
  add column if not exists deleted_at timestamptz;

comment on column public.recurring_tasks.expected_end_date is
  'Optional planned end date for the recurring template (must be >= start_date; enforced at the application layer).';
comment on column public.recurring_tasks.deleted_at is
  'Soft-delete timestamp. Rows with deleted_at set are hidden from lists and excluded from generation (the delete path also sets is_active = false).';
