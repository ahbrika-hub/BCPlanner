-- Overdue-escalation daily digest: a read-only helper that returns overdue tasks
-- using the project's CANONICAL overdue rule (mirrors src/lib/tasks/overdue.ts
-- and the listTasks overdue filter):
--
--   due_date IS NOT NULL
--   AND due_date < current_date
--   AND status NOT IN ('completed','cancelled','rejected')
--
-- Two scopes from one function:
--   * p_assignee = <uuid>  → that assignee's own overdue tasks
--   * p_assignee = NULL     → ALL overdue tasks (manager/oversight scope; the
--                             project has no manager→report mapping, and
--                             section_head/admin hold tasks.read_all = org-wide
--                             visibility, so the manager digest is org-wide).
--
-- SECURITY DEFINER + search_path='' per project convention. Execute is granted
-- to service_role ONLY (the cron runs as service-role). It is deliberately NOT
-- granted to `authenticated`: doing so would let any signed-in user call it with
-- no argument and read every overdue task, bypassing RLS. This does not broaden
-- any table RLS. Read-only; touches no lifecycle code.

create or replace function public.overdue_tasks(p_assignee uuid default null)
returns table (
  id            uuid,
  task_no       text,
  title         text,
  due_date      date,
  status        public.task_status,
  priority      public.task_priority,
  assignee_id   uuid,
  assignee_name text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    t.id,
    t.task_no,
    t.title,
    t.due_date,
    t.status,
    t.priority,
    t.assignee_id,
    pr.full_name as assignee_name
  from public.tasks t
  left join public.profiles pr on pr.id = t.assignee_id
  where t.due_date is not null
    and t.due_date < current_date
    and t.status not in ('completed', 'cancelled', 'rejected')
    and (p_assignee is null or t.assignee_id = p_assignee)
  order by t.due_date asc, t.task_no asc;
$$;

-- Revoke from public AND from anon/authenticated explicitly: the schema's
-- default privileges (set in the reset migration) auto-grant EXECUTE on new
-- functions to anon/authenticated, so revoking from PUBLIC alone is NOT enough.
-- This keeps overdue_tasks callable ONLY by service_role (the cron), so a signed-
-- in user can't call it with no arg and read every overdue task via SECURITY
-- DEFINER. Verified in Gate B.
revoke all on function public.overdue_tasks(uuid) from public, anon, authenticated;
grant execute on function public.overdue_tasks(uuid) to service_role;
