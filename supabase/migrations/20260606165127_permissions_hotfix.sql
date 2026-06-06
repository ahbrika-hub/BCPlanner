-- Permissions hotfix: get_my_permissions()
--
-- The app loaded a user's permission keys with a client query on
-- role_permissions, but that table's RLS SELECT policy requires
-- authorize('roles.manage') — held only by admins. As a result non-admin users
-- (section_head / employee / ceo) loaded an empty permission set and were locked
-- out of every gated page. This SECURITY DEFINER function returns the current
-- user's permission keys regardless of role_permissions RLS (same pattern as
-- authorize()), and is what the app calls instead.

create or replace function public.get_my_permissions()
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(p.key), '{}')
  from public.role_permissions rp
  join public.permissions p on p.id = rp.permission_id
  join public.profiles pr on pr.id = auth.uid() and pr.is_active = true
  where rp.role = pr.role
$$;

revoke all on function public.get_my_permissions() from public;
grant execute on function public.get_my_permissions() to authenticated, service_role;
