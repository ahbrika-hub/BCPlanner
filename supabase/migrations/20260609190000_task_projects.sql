-- Task department/project classifier. ADDITIVE and DISTINCT from the existing
-- free-text tasks.category sentinel (e.g. 'Dashboard Update'), which is left
-- completely untouched.
--   * task_category: 'department' (default) | 'project'.
--   * project_id: optional FK to projects, set iff task_category = 'project'.
-- Existing rows backfill to ('department', null). The recurring generator and
-- any other insert that omits these columns get the same safe defaults.

alter table public.tasks
  add column if not exists task_category text not null default 'department'
    check (task_category in ('department', 'project'));

alter table public.tasks
  add column if not exists project_id uuid references public.projects(id);

create index if not exists idx_tasks_project_id on public.tasks (project_id);

-- Integrity: a project is linked iff the task is categorised as a project.
-- NOT VALID + VALIDATE keeps the lock light; all existing rows are
-- ('department', null) so validation passes.
alter table public.tasks
  add constraint tasks_project_link
    check ((task_category = 'project') = (project_id is not null)) not valid;
alter table public.tasks validate constraint tasks_project_link;
