-- Migration 3: rbac
-- Permission catalogue, role->permission mapping, and the authorize() helper.
-- Idempotent.

-- ── permissions ───────────────────────────────────────────────────────────
create table if not exists public.permissions (
  id          uuid primary key default gen_random_uuid(),
  key         text not null unique,
  description text,
  category    text,
  created_at  timestamptz not null default now()
);

create index if not exists idx_permissions_category on public.permissions (category);

-- ── role_permissions ──────────────────────────────────────────────────────
create table if not exists public.role_permissions (
  role          public.user_role not null,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  primary key (role, permission_id)
);

create index if not exists idx_role_permissions_role on public.role_permissions (role);

-- ── authorize(): does the current user's role hold the requested permission? ─
-- STABLE + SECURITY DEFINER so it can read the RBAC tables regardless of the
-- caller's own RLS grants. Empty search_path per Supabase hardening guidance.
create or replace function public.authorize(requested_permission text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  has_permission boolean;
begin
  select exists (
    select 1
    from public.role_permissions rp
    join public.permissions p on p.id = rp.permission_id
    join public.profiles pr on pr.id = auth.uid() and pr.is_active = true
    where p.key = requested_permission
      and rp.role = pr.role
  )
  into has_permission;

  return coalesce(has_permission, false);
end;
$$;
