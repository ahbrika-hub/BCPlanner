-- Gate 1 — Self-registration (@saptco.com) + pending-approval account status.
-- Adds an account-status concept, an email-domain allow-list, the narrow
-- signups.approve permission, and rewrites the signup trigger to: force the
-- employee role, enforce the email domain at the DB (defense-in-depth), mark
-- self-signups pending/inactive, and notify admins + section heads.
-- Idempotent. New migration — does not edit any deployed migration.

-- 1. account_status concept --------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'account_status') then
    create type public.account_status as enum ('pending', 'active', 'inactive');
  end if;
end $$;

alter table public.profiles
  add column if not exists account_status public.account_status not null default 'active';

create index if not exists idx_profiles_account_status
  on public.profiles (account_status);

-- 2. Email-domain allow-list (self-registration) -----------------------------
insert into public.app_settings (key, value, description) values
  ('signup_allowed_domains', 'saptco.com',
   'Comma-separated email domains permitted to self-register')
on conflict (key) do nothing;

-- 3. signups.approve permission (admin + section_head only) ------------------
--    Narrow: covers approving pending registrations only. Full user CRUD stays
--    on users.manage.
insert into public.permissions (key, description, category) values
  ('signups.approve',
   'Approve a pending self-registration (activate + assign role/department)',
   'users')
on conflict (key) do nothing;

insert into public.role_permissions (role, permission_id)
select r.role, p.id
from (values ('admin'::public.user_role), ('section_head'::public.user_role))
       as r(role)
cross join public.permissions p
where p.key = 'signups.approve'
on conflict do nothing;

-- 4. handle_new_user(): force employee, enforce domain, pending self-signups,
--    notify approvers. SECURITY DEFINER + empty search_path (Supabase hardening).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_self_signup boolean := coalesce(new.raw_user_meta_data ->> 'self_signup', '') = 'true';
  v_allowed     text;
  v_domain      text := lower(split_part(coalesce(new.email, ''), '@', 2));
  v_status      public.account_status;
begin
  -- Email-domain restriction (defense in depth). Enforced for real auth-service
  -- signups — GoTrue connects as supabase_auth_admin — so even a direct anon API
  -- signup is rejected. SQL/seed/test inserts run as a superuser role and are
  -- trusted, so they bypass (keeps `supabase db reset` fixtures working).
  if session_user = 'supabase_auth_admin' then
    select value into v_allowed
    from public.app_settings where key = 'signup_allowed_domains';
    if v_allowed is not null
       and v_domain <> all (string_to_array(v_allowed, ',')) then
      raise exception 'Registration is limited to: %', v_allowed
        using errcode = 'check_violation';
    end if;
  end if;

  -- Self-signups are pending + inactive until approved; everything else
  -- (admin invites, SQL fixtures) stays active. Role is ALWAYS employee here —
  -- privilege assignment is an explicit approve/admin action.
  v_status := case when v_self_signup then 'pending' else 'active' end;

  insert into public.profiles (id, full_name, email, role, account_status, is_active)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.email, ''),
    'employee',
    v_status,
    v_status = 'active'
  )
  on conflict (id) do nothing;

  -- Notify approvers (admin + section_head) of a new pending registration.
  if v_self_signup then
    insert into public.notifications (user_id, type, title, message)
    select pr.id, 'system',
           'New registration pending approval',
           coalesce(new.email, 'A new user')
             || ' has registered and is awaiting approval.'
    from public.profiles pr
    where pr.role in ('admin', 'section_head') and pr.is_active = true;
  end if;

  return new;
end;
$$;

-- 5. guard_profile_privileges(): also guard account_status, and allow the
--    privileged change when the actor holds users.manage OR signups.approve.
create or replace function public.guard_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- No JWT => server/service-role/SQL context (e.g. first-admin promotion).
  if auth.uid() is null then
    return new;
  end if;

  if (new.role is distinct from old.role
      or new.department_id is distinct from old.department_id
      or new.is_active is distinct from old.is_active
      or new.account_status is distinct from old.account_status)
     and not (public.authorize('users.manage')
              or public.authorize('signups.approve')) then
    raise exception
      'Insufficient privileges to change role, department, or account status'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;
