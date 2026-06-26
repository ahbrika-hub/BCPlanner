-- @mentions in task comments (individuals only). Additive: a new notification
-- type, a column to persist which users a comment mentioned, and a SECURITY
-- DEFINER helper that returns the users who can SEE a task — reused both as the
-- mentionable-user picker source AND as the server-side gate on who may be
-- notified, so a mention can never leak a task to someone scoped out of it.
--
-- Does NOT touch the task approval/transition lifecycle.

-- 1) New notification type. ADD VALUE IF NOT EXISTS is idempotent. The value is
--    not USED in this migration, so it is safe inside the migration transaction
--    (Postgres only forbids using a newly added enum value in the same tx).
alter type public.notification_type add value if not exists 'mention';

-- 2) Persist the mentioned users on the comment row. A uuid[] column (not a join
--    table): mentions are a small, bounded, per-comment set that is always read
--    with the comment and never queried "which comments mention user X" (the
--    per-user fan-out + queryability already lives in notifications). A column
--    keeps it in the same row with no extra join — matching the project's
--    lightweight additive style. See report for the full justification.
alter table public.task_comments
  add column if not exists mentioned_user_ids uuid[] not null default '{}'::uuid[];

-- 3) Mentionable users for a task = exactly the task SELECT-RLS audience
--    (created_by OR assignee_id OR holders of tasks.read_all). SECURITY DEFINER
--    so it can read role_permissions (normally admin-only) to resolve which
--    roles hold tasks.read_all, but it first verifies the CALLER can see the
--    task and otherwise returns nothing — it never reveals an audience for a
--    task the caller cannot see.
create or replace function public.task_mentionable_users(p_task_id uuid)
returns table (id uuid, display_name text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_created_by uuid;
  v_assignee   uuid;
  v_caller     uuid := auth.uid();
  v_can_see    boolean;
begin
  select t.created_by, t.assignee_id
    into v_created_by, v_assignee
  from public.tasks t
  where t.id = p_task_id;

  if not found then
    return;
  end if;

  -- Same visibility rule as tasks_select / task_comments_select.
  v_can_see :=
    v_caller = v_created_by
    or v_caller = v_assignee
    or exists (
      select 1
      from public.role_permissions rp
      join public.permissions pm on pm.id = rp.permission_id
      join public.profiles pr on pr.id = v_caller
      where pm.key = 'tasks.read_all' and rp.role = pr.role
    );

  if not coalesce(v_can_see, false) then
    return;
  end if;

  return query
  select pr.id, pr.full_name
  from public.profiles pr
  where pr.is_active = true
    and (
      pr.id = v_created_by
      or pr.id = v_assignee
      or exists (
        select 1
        from public.role_permissions rp
        join public.permissions pm on pm.id = rp.permission_id
        where pm.key = 'tasks.read_all' and rp.role = pr.role
      )
    )
  order by pr.full_name;
end;
$$;

grant execute on function public.task_mentionable_users(uuid) to authenticated;
