-- Projects reference entity (mirrors business_lines): admin-managed, the
-- foundation for project-type tasks. Additive only — no changes to tasks or
-- other modules. Task wiring is a separate change.

create table if not exists public.projects (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  business_line_id uuid references public.business_lines(id),
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists idx_projects_business_line_id
  on public.projects (business_line_id);

-- updated_at trigger (same convention as business_lines / app_settings).
drop trigger if exists set_projects_updated_at on public.projects;
create trigger set_projects_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

alter table public.projects enable row level security;

-- ── Permissions (seeded here, mirroring the existing permission seed pattern) ─
insert into public.permissions (key, description, category) values
  ('projects.read',   'Read projects',   'projects'),
  ('projects.manage', 'Manage projects', 'projects')
on conflict (key) do nothing;

-- projects.read → all roles (reference data visible to everyone authenticated).
insert into public.role_permissions (role, permission_id)
select r.role, p.id
from (values ('admin'::public.user_role), ('section_head'::public.user_role),
             ('employee'::public.user_role), ('ceo'::public.user_role))
       as r(role)
cross join public.permissions p
where p.key = 'projects.read'
on conflict do nothing;

-- projects.manage → admin only.
insert into public.role_permissions (role, permission_id)
select r.role, p.id
from (values ('admin'::public.user_role)) as r(role)
cross join public.permissions p
where p.key = 'projects.manage'
on conflict do nothing;

-- ── RLS: read via projects.read; insert/update/delete via projects.manage ────
drop policy if exists projects_select on public.projects;
create policy projects_select on public.projects
  for select to authenticated
  using (public.authorize('projects.read'));

drop policy if exists projects_write on public.projects;
create policy projects_write on public.projects
  for all to authenticated
  using (public.authorize('projects.manage'))
  with check (public.authorize('projects.manage'));
