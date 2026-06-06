-- Migration 2: core_identity
-- Shared updated_at trigger, departments, profiles, and the auth.users -> profiles bridge.
-- Idempotent.

-- ── Shared trigger function: stamp updated_at ─────────────────────────────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ── departments ───────────────────────────────────────────────────────────
create table if not exists public.departments (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  description text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists set_departments_updated_at on public.departments;
create trigger set_departments_updated_at
  before update on public.departments
  for each row execute function public.set_updated_at();

-- ── profiles ──────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  full_name     text not null default '',
  email         text not null default '',
  role          public.user_role not null default 'employee',
  department_id uuid references public.departments(id) on delete set null,
  job_title     text,
  is_active     boolean not null default true,
  avatar_url    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_profiles_department_id on public.profiles (department_id);
create index if not exists idx_profiles_role on public.profiles (role);

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ── auth.users -> profiles bridge ─────────────────────────────────────────
-- Always forces the 'employee' role on signup; privilege escalation is an
-- explicit admin action (see docs/DATABASE.md). SECURITY DEFINER with an empty
-- search_path per Supabase hardening guidance.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.email, ''),
    'employee'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
