-- Migration: CEO task-request oversight (Part B)
-- ----------------------------------------------------------------------------
-- Adds the CEO oversight surface WITHOUT broadening the base tasks SELECT RLS:
--   • permission tasks.request_update (granted to ceo only).
--   • get_ceo_department_tasks()  — SECURITY DEFINER, returns ALL department
--     tasks for the CEO with NO assignee identity (the assignee columns are
--     simply not selected), flagging the CEO's own requests is_my_request.
--   • request_task_update(p_task_id) — SECURITY DEFINER, lets the CEO nudge for
--     progress on a task THEY created (no new task); notifies assignee +
--     section_heads + admins, de-duped within a short window.
-- Idempotent; ends with end-state assertions.

-- ── permission + grant (standard pattern) ───────────────────────────────────
insert into public.permissions (key, description, category) values
  ('tasks.request_update', 'Request an update on a task you created', 'tasks')
on conflict (key) do nothing;

insert into public.role_permissions (role, permission_id)
select 'ceo', id from public.permissions where key = 'tasks.request_update'
on conflict (role, permission_id) do nothing;

-- ── CEO oversight read (assignee identity intentionally NOT returned) ────────
create or replace function public.get_ceo_department_tasks()
returns table (
  id            uuid,
  task_no       text,
  title         text,
  status        public.task_status,
  priority      public.task_priority,
  business_line text,
  due_date      date,
  created_at    timestamptz,
  is_my_request boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  -- CEO-only surface.
  if (select pr.role from public.profiles pr where pr.id = auth.uid()) is distinct from 'ceo' then
    raise exception 'Only the CEO may call get_ceo_department_tasks()';
  end if;

  return query
    select
      t.id,
      t.task_no,
      t.title,
      t.status,
      t.priority,
      bl.name as business_line,
      t.due_date,
      t.created_at,
      (t.created_by = auth.uid()) as is_my_request
    from public.tasks t
    left join public.business_lines bl on bl.id = t.business_line_id
    order by t.created_at desc;
end;
$$;

grant execute on function public.get_ceo_department_tasks() to authenticated;

-- ── CEO "request update" nudge on a task the CEO created (no new task) ───────
create or replace function public.request_task_update(p_task_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller uuid := auth.uid();
  v_role   public.user_role;
  v_task   record;
  v_uid    uuid;
  v_recent integer;
  v_msg    text;
begin
  select pr.role into v_role from public.profiles pr where pr.id = v_caller;
  if v_role is distinct from 'ceo' then
    raise exception 'Only the CEO may request a task update';
  end if;

  select t.id, t.task_no, t.created_by, t.assignee_id
    into v_task
    from public.tasks t
   where t.id = p_task_id;
  if not found then
    raise exception 'Task not found';
  end if;

  -- His OWN request only — never broaden to other people's tasks.
  if v_task.created_by is distinct from v_caller then
    return jsonb_build_object('status', 'rejected', 'reason', 'not your request');
  end if;

  -- De-dup: skip a repeat nudge on the same task within the last hour.
  select count(*) into v_recent
    from public.notifications n
   where n.task_id = p_task_id
     and n.type = 'system'
     and n.title = 'CEO requests an update'
     and n.created_at > now() - interval '1 hour';
  if v_recent > 0 then
    return jsonb_build_object('status', 'duplicate');
  end if;

  v_msg := 'The CEO requests an update on ' || coalesce(v_task.task_no, 'this task');

  -- Notify the assignee (if any) + every active section_head + admin.
  if v_task.assignee_id is not null then
    perform public.create_notification(v_task.assignee_id, 'system',
      'CEO requests an update', v_msg, p_task_id);
  end if;

  for v_uid in
    select pr.id from public.profiles pr
     where pr.role in ('section_head', 'admin')
       and pr.is_active
       and pr.id is distinct from v_task.assignee_id
  loop
    perform public.create_notification(v_uid, 'system',
      'CEO requests an update', v_msg, p_task_id);
  end loop;

  return jsonb_build_object('status', 'ok');
end;
$$;

grant execute on function public.request_task_update(uuid) to authenticated;

-- ── End-state assertions ────────────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from public.role_permissions rp
    join public.permissions p on p.id = rp.permission_id
    where rp.role = 'ceo' and p.key = 'tasks.request_update'
  ) then
    raise exception 'ceo should hold tasks.request_update';
  end if;
  if to_regprocedure('public.get_ceo_department_tasks()') is null then
    raise exception 'get_ceo_department_tasks() missing';
  end if;
  if to_regprocedure('public.request_task_update(uuid)') is null then
    raise exception 'request_task_update(uuid) missing';
  end if;
end $$;
