-- Project templates: admin-defined reusable "project recipes". A parent
-- project_templates row + a child project_template_tasks row per task definition.
--
-- Data-model choice — a child TABLE (not a jsonb payload): a template has a
-- one-to-many set of task defs, each of which reuses the SAME default-field shape
-- as task_templates (title, description, priority, business_line_id,
-- estimated_effort_hours). A relational child table gives a real FK to
-- business_lines, per-row validation, and stable ordering (position) — none of
-- which a jsonb blob offers. (task_templates itself stores a single def as flat
-- columns; there is no existing one-to-many template precedent to mirror, so the
-- relational shape is the natural extension.)
--
-- Permissions reuse the EXISTING projects gates (no new key): SELECT via
-- projects.read (all roles — same as the projects/task-templates reference
-- tables), write via projects.manage (admin + section_head). Project templates
-- belong to the projects module, so they inherit its gates; per-role totals are
-- unchanged. Generation reuses createTaskAction, so this migration never inserts
-- tasks and does not touch the lifecycle.

create table if not exists public.project_templates (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 255),
  description text,
  is_active   boolean not null default true,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.project_template_tasks (
  id                     uuid primary key default gen_random_uuid(),
  template_id            uuid not null references public.project_templates(id) on delete cascade,
  title                  text not null check (char_length(title) between 1 and 255),
  description            text,
  priority               public.task_priority,
  business_line_id       uuid references public.business_lines(id),
  estimated_effort_hours numeric(6, 2),
  position               integer not null default 0,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index if not exists idx_project_template_tasks_template_id
  on public.project_template_tasks (template_id);

-- updated_at triggers (same convention as projects / task_templates).
drop trigger if exists set_project_templates_updated_at on public.project_templates;
create trigger set_project_templates_updated_at
  before update on public.project_templates
  for each row execute function public.set_updated_at();

drop trigger if exists set_project_template_tasks_updated_at on public.project_template_tasks;
create trigger set_project_template_tasks_updated_at
  before update on public.project_template_tasks
  for each row execute function public.set_updated_at();

alter table public.project_templates enable row level security;
alter table public.project_template_tasks enable row level security;

-- ── RLS: read via projects.read; write via projects.manage (both tables) ─────
drop policy if exists project_templates_select on public.project_templates;
create policy project_templates_select on public.project_templates
  for select to authenticated
  using (public.authorize('projects.read'));

drop policy if exists project_templates_write on public.project_templates;
create policy project_templates_write on public.project_templates
  for all to authenticated
  using (public.authorize('projects.manage'))
  with check (public.authorize('projects.manage'));

drop policy if exists project_template_tasks_select on public.project_template_tasks;
create policy project_template_tasks_select on public.project_template_tasks
  for select to authenticated
  using (public.authorize('projects.read'));

drop policy if exists project_template_tasks_write on public.project_template_tasks;
create policy project_template_tasks_write on public.project_template_tasks
  for all to authenticated
  using (public.authorize('projects.manage'))
  with check (public.authorize('projects.manage'));
