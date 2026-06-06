-- RLS test suite.
-- Model: every logged-in user connects as the single Postgres role
-- `authenticated`; their application role is derived from the JWT `sub` claim
-- (-> profiles.role) via authorize(). We therefore vary request.jwt.claims per
-- "user" rather than switching DB roles.
--
-- Run against a Supabase-style database (auth schema, authenticated role, and
-- default public grants present). Everything runs in one transaction and is
-- rolled back; a non-zero exit (RAISE) signals failure for CI gating.
--
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/rls_test.sql "<db-url>"

begin;

-- ── Fixtures (as the privileged migration/owner role) ─────────────────────
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000e1', 'emp1@example.com',  '{"full_name":"Employee One"}'),
  ('00000000-0000-0000-0000-0000000000e2', 'emp2@example.com',  '{"full_name":"Employee Two"}'),
  ('00000000-0000-0000-0000-0000000000a3', 'sh1@example.com',   '{"full_name":"Section Head"}'),
  ('00000000-0000-0000-0000-0000000000c4', 'ceo1@example.com',  '{"full_name":"Chief Exec"}'),
  ('00000000-0000-0000-0000-0000000000d5', 'admin1@example.com','{"full_name":"Admin"}')
on conflict do nothing;

update public.profiles set role = 'section_head' where id = '00000000-0000-0000-0000-0000000000a3';
update public.profiles set role = 'ceo'          where id = '00000000-0000-0000-0000-0000000000c4';
update public.profiles set role = 'admin'        where id = '00000000-0000-0000-0000-0000000000d5';

insert into public.tasks (id, title, created_by, assignee_id, status) values
  ('00000000-0000-0000-0000-00000000000a', 'Task A (emp1 own+assignee)', '00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000e1', 'assigned'),
  ('00000000-0000-0000-0000-00000000000b', 'Task B (emp2 own)',          '00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000e2', 'assigned'),
  ('00000000-0000-0000-0000-00000000000c', 'Task C (sh1 -> emp1)',       '00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000e1', 'assigned')
on conflict do nothing;

insert into public.notifications (id, user_id, type, title) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000e1', 'system', 'hello')
on conflict do nothing;

insert into public.audit_logs (action, entity_type, entity_id) values
  ('test', 'task', '00000000-0000-0000-0000-00000000000a')
on conflict do nothing;

-- ── Results sink ──────────────────────────────────────────────────────────
create temporary table rls_results (step int, name text, result text) on commit drop;
grant insert, select on rls_results to authenticated;

-- ── Test body ───────────────────────────────────────────────────────────--
do $$
declare
  emp1   uuid := '00000000-0000-0000-0000-0000000000e1';
  sh1    uuid := '00000000-0000-0000-0000-0000000000a3';
  ceo1   uuid := '00000000-0000-0000-0000-0000000000c4';
  admin1 uuid := '00000000-0000-0000-0000-0000000000d5';
  taskA  uuid := '00000000-0000-0000-0000-00000000000a';
  taskB  uuid := '00000000-0000-0000-0000-00000000000b';
  taskC  uuid := '00000000-0000-0000-0000-00000000000c';
  upd1   uuid := '00000000-0000-0000-0000-0000000000d1';
  n      int;
  rc     int;
  perm   uuid;
begin
  set role authenticated;  -- function-local; reverts on exit

  -- ===== EMPLOYEE (emp1) =====
  perform set_config('request.jwt.claims', json_build_object('sub', emp1, 'role', 'authenticated')::text, true);

  select count(*) into n from public.tasks where id = taskA;
  insert into rls_results values (1, 'employee: SELECT own task', case when n = 1 then 'PASS' else 'FAIL' end);

  select count(*) into n from public.tasks where id = taskC;
  insert into rls_results values (2, 'employee: SELECT assigned task', case when n = 1 then 'PASS' else 'FAIL' end);

  select count(*) into n from public.tasks where id = taskB;
  insert into rls_results values (3, 'employee: cannot SELECT others'' task', case when n = 0 then 'PASS' else 'FAIL' end);

  begin
    insert into public.tasks (title, created_by) values ('emp1 new task', emp1);
    insert into rls_results values (4, 'employee: INSERT own task', 'PASS');
  exception when others then
    insert into rls_results values (4, 'employee: INSERT own task', 'FAIL');
  end;

  insert into rls_results values (5, 'employee: authorize(tasks.approve) = false',
    case when public.authorize('tasks.approve') = false then 'PASS' else 'FAIL' end);

  begin
    insert into public.task_updates (id, task_id, updated_by, progress_percentage)
      values (upd1, taskA, emp1, 40);
    insert into rls_results values (6, 'employee: INSERT task_update on own assigned task', 'PASS');
  exception when others then
    insert into rls_results values (6, 'employee: INSERT task_update on own assigned task', 'FAIL');
  end;

  update public.task_updates set progress_percentage = 99 where id = upd1;
  get diagnostics rc = row_count;
  insert into rls_results values (7, 'employee: cannot UPDATE task_update (immutable)',
    case when rc = 0 then 'PASS' else 'FAIL' end);

  select count(*) into n from public.notifications where user_id = emp1;
  insert into rls_results values (8, 'employee: SELECT own notifications', case when n >= 1 then 'PASS' else 'FAIL' end);

  begin
    insert into public.notifications (user_id, type, title) values (emp1, 'system', 'x');
    insert into rls_results values (9, 'employee: cannot INSERT notifications', 'FAIL');
  exception when others then
    insert into rls_results values (9, 'employee: cannot INSERT notifications', 'PASS');
  end;

  select count(*) into n from public.audit_logs;
  insert into rls_results values (10, 'employee: cannot SELECT audit_logs', case when n = 0 then 'PASS' else 'FAIL' end);

  -- ===== SECTION HEAD (sh1) =====
  perform set_config('request.jwt.claims', json_build_object('sub', sh1, 'role', 'authenticated')::text, true);

  select count(*) into n from public.tasks;
  insert into rls_results values (11, 'section_head: SELECT all tasks', case when n >= 3 then 'PASS' else 'FAIL' end);

  insert into rls_results values (12, 'section_head: authorize(tasks.approve) = true',
    case when public.authorize('tasks.approve') then 'PASS' else 'FAIL' end);

  select count(*) into n from public.audit_logs;
  insert into rls_results values (13, 'section_head: SELECT audit_logs', case when n >= 1 then 'PASS' else 'FAIL' end);

  begin
    insert into public.recurring_tasks (title, frequency, start_date, next_generation_date, created_by)
      values ('weekly report', 'weekly', current_date, current_date, sh1);
    insert into rls_results values (14, 'section_head: manage recurring_tasks', 'PASS');
  exception when others then
    insert into rls_results values (14, 'section_head: manage recurring_tasks', 'FAIL');
  end;

  begin
    select id into perm from public.permissions where key = 'audit.read';
    insert into public.role_permissions (role, permission_id) values ('employee', perm);
    insert into rls_results values (15, 'section_head: cannot modify role_permissions', 'FAIL');
  exception when others then
    insert into rls_results values (15, 'section_head: cannot modify role_permissions', 'PASS');
  end;

  -- ===== CEO (ceo1) =====
  perform set_config('request.jwt.claims', json_build_object('sub', ceo1, 'role', 'authenticated')::text, true);

  select count(*) into n from public.tasks where id = taskB;
  insert into rls_results values (16, 'ceo: SELECT all tasks', case when n = 1 then 'PASS' else 'FAIL' end);

  begin
    insert into public.tasks (title, created_by) values ('ceo task', ceo1);
    insert into rls_results values (17, 'ceo: cannot INSERT a task', 'FAIL');
  exception when others then
    insert into rls_results values (17, 'ceo: cannot INSERT a task', 'PASS');
  end;

  insert into rls_results values (18, 'ceo: authorize(tasks.approve) = false',
    case when public.authorize('tasks.approve') = false then 'PASS' else 'FAIL' end);

  begin
    insert into public.task_comments (task_id, author_id, comment_role, comment_text)
      values (taskA, ceo1, 'ceo', 'exec note');
    insert into rls_results values (19, 'ceo: INSERT task_comment', 'PASS');
  exception when others then
    insert into rls_results values (19, 'ceo: INSERT task_comment', 'FAIL');
  end;

  select count(*) into n from public.audit_logs;
  insert into rls_results values (20, 'ceo: cannot SELECT audit_logs', case when n = 0 then 'PASS' else 'FAIL' end);

  -- ===== ADMIN (admin1) =====
  perform set_config('request.jwt.claims', json_build_object('sub', admin1, 'role', 'authenticated')::text, true);

  insert into rls_results values (21, 'admin: has full authorization',
    case when public.authorize('tasks.delete') and public.authorize('roles.manage') and public.authorize('audit.read')
         then 'PASS' else 'FAIL' end);

  begin
    select id into perm from public.permissions where key = 'tasks.delete';
    insert into public.role_permissions (role, permission_id) values ('ceo', perm);
    insert into rls_results values (22, 'admin: INSERT role_permissions', 'PASS');
  exception when others then
    insert into rls_results values (22, 'admin: INSERT role_permissions', 'FAIL');
  end;
end
$$;

-- ── Report + gate ─────────────────────────────────────────────────────────
select step, result, name from rls_results order by step;

do $$
declare
  failures int;
begin
  select count(*) into failures from rls_results where result <> 'PASS';
  raise notice 'RLS SUMMARY: % passed, % failed',
    (select count(*) from rls_results where result = 'PASS'), failures;
  if failures > 0 then
    raise exception 'RLS test suite FAILED: % failing test(s)', failures;
  end if;
end
$$;

rollback;
