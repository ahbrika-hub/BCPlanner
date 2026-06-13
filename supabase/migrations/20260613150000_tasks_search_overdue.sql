-- Task-list search + overdue support. ADDITIVE only: no RLS change, no new
-- status, no change to existing columns' meaning. Idempotent.
--
-- Search design (see PR notes): a STORED generated tsvector over
-- title + task_no + description using the 'simple' config (no stemming /
-- stopwords — short titles and task numbers keep every token), plus a pg_trgm
-- trigram index on task_no so arbitrary substrings of the hyphenated task
-- number (e.g. '2026-0001', '0001') match, which plain FTS token matching
-- cannot do. The app searches FTS OR task_no ILIKE, so all of:
--   (a) 'TSS-BC-2026-0001'  (b) '2026-0001' / '0001'  (c) a title word
--   (d) a description word
-- return the task.

create extension if not exists pg_trgm;

-- 2-arg to_tsvector(regconfig, text) is IMMUTABLE, so it is valid in a STORED
-- generated column. coalesce keeps nullable task_no/description from voiding it.
alter table public.tasks
  add column if not exists search_vector tsvector
  generated always as (
    to_tsvector(
      'simple',
      coalesce(title, '') || ' ' ||
      coalesce(task_no, '') || ' ' ||
      coalesce(description, '')
    )
  ) stored;

create index if not exists idx_tasks_search_vector
  on public.tasks using gin (search_vector);

create index if not exists idx_tasks_task_no_trgm
  on public.tasks using gin (task_no gin_trgm_ops);

-- Supports the derived overdue filter (status NOT IN (...) AND due_date < today).
create index if not exists idx_tasks_status_due_date
  on public.tasks (status, due_date);
