-- Migration 11: notify_role
-- SECURITY DEFINER helper to notify every active user of a role without
-- requiring the caller to be able to read other profiles under RLS
-- (e.g. an employee notifying all section_heads on submission).

create or replace function public.notify_role(
  p_role public.user_role,
  p_type public.notification_type,
  p_title text,
  p_message text,
  p_task_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected integer;
begin
  insert into public.notifications (user_id, type, title, message, task_id)
  select pr.id, p_type, p_title, p_message, p_task_id
  from public.profiles pr
  where pr.role = p_role and pr.is_active = true;
  get diagnostics affected = row_count;
  return affected;
end;
$$;

revoke all on function public.notify_role(public.user_role, public.notification_type, text, text, uuid) from public;
grant execute on function public.notify_role(public.user_role, public.notification_type, text, text, uuid)
  to authenticated, service_role;
