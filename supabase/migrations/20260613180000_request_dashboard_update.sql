-- On-demand "Request update" for the weekly dashboard. Lets admin / section_head
-- / ceo trigger a "Dashboard Update" task without general task-create rights and
-- without broadening the tasks INSERT RLS — the create goes through this gated
-- SECURITY DEFINER function only. Additive: new permission + function.

-- 1. Permission: dashboard.request_update → admin, section_head, ceo. ----------
insert into public.permissions (key, description, category) values
  ('dashboard.request_update', 'Request an on-demand weekly dashboard update', 'dashboard')
on conflict (key) do nothing;

insert into public.role_permissions (role, permission_id)
select r.role, p.id
from (values ('admin'::public.user_role), ('section_head'::public.user_role),
             ('ceo'::public.user_role)) as r(role)
cross join public.permissions p
where p.key = 'dashboard.request_update'
on conflict do nothing;

-- 2. request_dashboard_update(p_assignee) -------------------------------------
--    - requires the caller to hold dashboard.request_update;
--    - de-dups: no-op if an OPEN Dashboard Update task already exists;
--    - assignee = the recurring Dashboard-Update task's assignee (dashboard
--      owner), else the caller-supplied arg;
--    - creates a directly-assigned, actionable task (no create→approve gate);
--    - notifies the assignee + every section_head + every admin (never ceo).
create or replace function public.request_dashboard_update(p_assignee uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_assignee uuid;
  v_id       uuid;
  v_uid      uuid;
begin
  if not public.authorize('dashboard.request_update') then
    raise exception 'Not authorized to request a dashboard update'
      using errcode = 'insufficient_privilege';
  end if;

  -- De-dup: refuse (no-op) while a Dashboard Update task is still open.
  if exists (
    select 1 from public.tasks
    where category = 'Dashboard Update'
      and status::text not in ('completed', 'cancelled', 'rejected')
  ) then
    return jsonb_build_object('created', false, 'reason', 'in_progress');
  end if;

  -- Resolve the assignee: configured dashboard owner, else the requester's pick.
  select rt.assignee_id into v_assignee
  from public.recurring_tasks rt
  where rt.category = 'Dashboard Update'
    and rt.is_active
    and rt.assignee_id is not null
  order by rt.created_at asc
  limit 1;

  v_assignee := coalesce(v_assignee, p_assignee);
  if v_assignee is null then
    return jsonb_build_object('created', false, 'reason', 'no_assignee');
  end if;

  -- Directly assigned + actionable; the transition guard only fires on UPDATE.
  insert into public.tasks (title, category, status, priority, created_by, assignee_id)
  values (
    'Weekly dashboard update',
    'Dashboard Update',
    'assigned',
    'high',
    auth.uid(),
    v_assignee
  )
  returning id into v_id;

  -- Notify the assignee…
  perform public.create_notification(
    v_assignee, 'task_assigned', 'Dashboard update assigned',
    'A weekly dashboard update was requested and assigned to you.', v_id
  );
  -- …and every active section_head + admin (excluding the assignee; never ceo).
  for v_uid in
    select id from public.profiles
    where role in ('section_head', 'admin') and is_active and id <> v_assignee
  loop
    perform public.create_notification(
      v_uid, 'system', 'Dashboard update requested',
      'An on-demand weekly dashboard update was requested.', v_id
    );
  end loop;

  return jsonb_build_object('created', true, 'taskId', v_id);
end;
$$;

revoke all on function public.request_dashboard_update(uuid) from public;
grant execute on function public.request_dashboard_update(uuid) to authenticated;
