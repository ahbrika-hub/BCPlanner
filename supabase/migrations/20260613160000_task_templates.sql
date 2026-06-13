-- Task templates: lightweight reusable defaults for task creation. MIRRORS the
-- projects reference table (#36, 20260609180000_projects.sql): managed by
-- admin/section_head, readable by everyone so the create-form selector works.
-- Additive only — NO change to tasks, the lifecycle/transition guard, or any
-- existing RLS/permissions beyond the two new templates.* keys + this table's
-- own policies. A template only carries DEFAULTS that map to real task-create
-- fields; creation still goes through the existing create-task action.

create table if not exists public.task_templates (
  id                     uuid primary key default gen_random_uuid(),
  name                   text not null,
  -- Defaults that map 1:1 onto create-task fields (all optional).
  title                  text,
  description            text,
  priority               public.task_priority,
  business_line_id       uuid references public.business_lines(id),
  estimated_effort_hours numeric,
  is_active              boolean not null default true,
  created_by             uuid references public.profiles(id) on delete set null,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index if not exists idx_task_templates_business_line_id
  on public.task_templates (business_line_id);

-- updated_at trigger (same convention as projects / business_lines).
drop trigger if exists set_task_templates_updated_at on public.task_templates;
create trigger set_task_templates_updated_at
  before update on public.task_templates
  for each row execute function public.set_updated_at();

alter table public.task_templates enable row level security;

-- ── Permissions (seeded here, mirroring the projects permission seed) ─────────
insert into public.permissions (key, description, category) values
  ('templates.read',   'Read task templates',   'templates'),
  ('templates.manage', 'Manage task templates', 'templates')
on conflict (key) do nothing;

-- templates.read → all roles (the create-form selector must work for everyone,
-- including employees who create tasks).
insert into public.role_permissions (role, permission_id)
select r.role, p.id
from (values ('admin'::public.user_role), ('section_head'::public.user_role),
             ('employee'::public.user_role), ('ceo'::public.user_role))
       as r(role)
cross join public.permissions p
where p.key = 'templates.read'
on conflict do nothing;

-- templates.manage → admin + section_head.
insert into public.role_permissions (role, permission_id)
select r.role, p.id
from (values ('admin'::public.user_role), ('section_head'::public.user_role))
       as r(role)
cross join public.permissions p
where p.key = 'templates.manage'
on conflict do nothing;

-- ── RLS: read via templates.read; insert/update/delete via templates.manage ──
drop policy if exists task_templates_select on public.task_templates;
create policy task_templates_select on public.task_templates
  for select to authenticated
  using (public.authorize('templates.read'));

drop policy if exists task_templates_write on public.task_templates;
create policy task_templates_write on public.task_templates
  for all to authenticated
  using (public.authorize('templates.manage'))
  with check (public.authorize('templates.manage'));
