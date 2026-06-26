-- Personal Saved Views for the Tasks list: a user saves the current task-list
-- filter/sort combination (a snapshot of the existing URL params) under a name,
-- pins it in the sidebar, and re-applies it in one click. Personal-only — there
-- is deliberately NO permission key: ownership is the gate, enforced entirely by
-- owner-scoped RLS (user_id = auth.uid()). Additive only; no changes to tasks or
-- other modules.

create table if not exists public.saved_views (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 80),
  config     jsonb not null,            -- snapshot of task-list filters + sort
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- user_id is the RLS predicate column and the natural lookup key; index it so the
-- owner-scoped policies are index-backed.
create index if not exists idx_saved_views_user_id
  on public.saved_views (user_id);

-- updated_at trigger (same convention as projects / business_lines / app_settings).
drop trigger if exists set_saved_views_updated_at on public.saved_views;
create trigger set_saved_views_updated_at
  before update on public.saved_views
  for each row execute function public.set_updated_at();

alter table public.saved_views enable row level security;

-- ── Owner-scoped RLS ─────────────────────────────────────────────────────────
-- No permission key (unlike the reference tables that use public.authorize()):
-- saved views are private per-user data, so the row owner IS the authorization.
-- Compare against (select auth.uid()) so the planner evaluates it once per
-- statement rather than once per row (Supabase RLS performance guidance).

drop policy if exists saved_views_select on public.saved_views;
create policy saved_views_select on public.saved_views
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists saved_views_insert on public.saved_views;
create policy saved_views_insert on public.saved_views
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists saved_views_update on public.saved_views;
create policy saved_views_update on public.saved_views
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists saved_views_delete on public.saved_views;
create policy saved_views_delete on public.saved_views
  for delete to authenticated
  using (user_id = (select auth.uid()));
