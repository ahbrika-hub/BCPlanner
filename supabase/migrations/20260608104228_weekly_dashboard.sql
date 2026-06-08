-- Gate 2 — Weekly dashboard ingest: snapshot table, permissions, storage bucket.
-- Idempotent. New migration — does not edit any deployed migration.

-- 1. Permissions: dashboard.upload + dashboard.read --------------------------
insert into public.permissions (key, description, category) values
  ('dashboard.upload', 'Upload a weekly dashboard snapshot', 'dashboard'),
  ('dashboard.read',   'Read weekly dashboard snapshots',    'dashboard')
on conflict (key) do nothing;

-- dashboard.upload → admin + section_head (employees upload via task assignment,
-- enforced row-by-row in the snapshot INSERT policy below).
insert into public.role_permissions (role, permission_id)
select r.role, p.id
from (values ('admin'::public.user_role), ('section_head'::public.user_role))
       as r(role)
cross join public.permissions p
where p.key = 'dashboard.upload'
on conflict do nothing;

-- dashboard.read → admin, section_head, ceo, employee (aggregated company
-- metrics; employees keep dashboard visibility per the existing rule).
insert into public.role_permissions (role, permission_id)
select r.role, p.id
from (values ('admin'::public.user_role), ('section_head'::public.user_role),
             ('ceo'::public.user_role), ('employee'::public.user_role))
       as r(role)
cross join public.permissions p
where p.key = 'dashboard.read'
on conflict do nothing;

-- 2. dashboard_snapshots table (history; dashboard reads the most recent) -----
create table if not exists public.dashboard_snapshots (
  id            uuid primary key default gen_random_uuid(),
  week_start    date not null,
  data          jsonb not null,
  uploaded_by   uuid references public.profiles(id) on delete set null,
  task_id       uuid references public.tasks(id) on delete set null,
  raw_file_path text,
  created_at    timestamptz not null default now()
);

create index if not exists idx_dashboard_snapshots_recent
  on public.dashboard_snapshots (week_start desc, created_at desc);

alter table public.dashboard_snapshots enable row level security;

-- SELECT: dashboard.read. (authorize() is SECURITY DEFINER over
-- role_permissions/profiles — no RLS circular dependency reintroduced.)
drop policy if exists dashboard_snapshots_select on public.dashboard_snapshots;
create policy dashboard_snapshots_select on public.dashboard_snapshots
  for select to authenticated
  using (public.authorize('dashboard.read'));

-- INSERT: dashboard.upload OR the assignee of the linked task; uploaded_by must
-- be the caller.
drop policy if exists dashboard_snapshots_insert on public.dashboard_snapshots;
create policy dashboard_snapshots_insert on public.dashboard_snapshots
  for insert to authenticated
  with check (
    uploaded_by = auth.uid()
    and (
      public.authorize('dashboard.upload')
      or (
        task_id is not null
        and exists (
          select 1 from public.tasks t
          where t.id = task_id and t.assignee_id = auth.uid()
        )
      )
    )
  );

-- 3. Private storage bucket: dashboard-uploads (mirror task-attachments) ------
insert into storage.buckets (id, name, public)
values ('dashboard-uploads', 'dashboard-uploads', false)
on conflict (id) do nothing;

-- storage.objects RLS. On hosted Supabase the migration role may not own
-- storage.objects; apply where permitted and skip gracefully otherwise (server
-- uses the service role + signed URLs there).
do $do$
begin
  execute 'alter table storage.objects enable row level security';

  execute 'drop policy if exists dashboard_uploads_insert on storage.objects';
  execute $p$
    create policy dashboard_uploads_insert on storage.objects
      for insert to authenticated
      with check (
        bucket_id = 'dashboard-uploads'
        and (public.authorize('dashboard.upload') or public.authorize('dashboard.read'))
      )
  $p$;

  execute 'drop policy if exists dashboard_uploads_select on storage.objects';
  execute $p$
    create policy dashboard_uploads_select on storage.objects
      for select to authenticated
      using (bucket_id = 'dashboard-uploads' and public.authorize('dashboard.read'))
  $p$;
exception
  when insufficient_privilege then
    raise notice 'Skipping storage.objects RLS for dashboard-uploads: migration role lacks ownership (platform defaults + app-layer signed URLs apply).';
end
$do$;
