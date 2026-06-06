-- Migration 13: management_support
-- Recurring-task generation engine + a profile privilege guard. Idempotent.

-- ── A1: generate_due_recurring_tasks (SECURITY DEFINER) ───────────────────
-- Materialises a task from every active template whose next_generation_date is
-- due, then advances that date by the template frequency. Returns the count.
create or replace function public.generate_due_recurring_tasks()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  rt      record;
  created integer := 0;
begin
  for rt in
    select * from public.recurring_tasks
    where is_active = true and next_generation_date <= current_date
    for update
  loop
    insert into public.tasks (
      title, description, category, business_line_id, assignee_id,
      created_by, priority, status, estimated_effort_hours, start_date
    )
    values (
      rt.title, rt.description, rt.category, rt.business_line_id, rt.assignee_id,
      rt.created_by, rt.priority,
      case when rt.assignee_id is not null then 'assigned'::public.task_status
           else 'pending_approval'::public.task_status end,
      rt.estimated_effort_hours, current_date
    );

    update public.recurring_tasks
    set next_generation_date = case rt.frequency
          when 'weekly'    then rt.next_generation_date + interval '1 week'
          when 'monthly'   then rt.next_generation_date + interval '1 month'
          when 'quarterly' then rt.next_generation_date + interval '3 months'
        end::date
    where id = rt.id;

    created := created + 1;
  end loop;

  return created;
end;
$$;

revoke all on function public.generate_due_recurring_tasks() from public;
grant execute on function public.generate_due_recurring_tasks() to authenticated, service_role;

-- ── A2: profile privilege guard ───────────────────────────────────────────
-- profiles UPDATE RLS allows a user to edit their own row, which would let them
-- change their own role/department/active status. This BEFORE UPDATE guard
-- blocks changes to those privileged columns unless the actor holds
-- users.manage. Non-privileged fields (full_name, job_title, avatar_url) remain
-- self-editable.
create or replace function public.guard_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Only restrict authenticated client requests. With no JWT (auth.uid() null)
  -- this is a server/service-role/SQL-console context (e.g. the documented
  -- first-admin promotion), which is allowed.
  if auth.uid() is null then
    return new;
  end if;

  if (new.role is distinct from old.role
      or new.department_id is distinct from old.department_id
      or new.is_active is distinct from old.is_active)
     and not public.authorize('users.manage') then
    raise exception 'Insufficient privileges to change role, department, or active status'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_profile_privileges_trigger on public.profiles;
create trigger guard_profile_privileges_trigger
  before update on public.profiles
  for each row execute function public.guard_profile_privileges();
