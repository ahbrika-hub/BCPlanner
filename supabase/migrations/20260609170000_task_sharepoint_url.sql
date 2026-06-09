-- Optional SharePoint link on tasks.
-- Additive only: one nullable column. No RLS / policy / constraint changes —
-- the column is editable through the existing task create/update path, so the
-- same roles that can already edit a task can set it (row-level UPDATE policy is
-- unchanged; Postgres RLS is row-level, not column-level).

alter table public.tasks
  add column if not exists sharepoint_url text;

comment on column public.tasks.sharepoint_url is
  'Optional SharePoint document/library URL for the task (https only; validated at the application layer).';
