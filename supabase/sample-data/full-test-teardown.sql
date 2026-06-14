-- ============================================================================
-- TSS Planner — TEST TEARDOWN  (supabase/sample-data/full-test-teardown.sql)
-- ----------------------------------------------------------------------------
-- Removes EVERYTHING created by full-test-seed.sql in proven FK-safe child→parent
-- order, in ONE transaction (any error rolls the whole thing back). Idempotent:
-- safe to run twice.
--
-- SAFETY: the five @tss.test users are throwaway and are fully deleted (profiles
-- + auth). The admin account (tss.bc2026@gmail.com) is your REAL account — it is
-- NEVER deleted, and admin-authored test rows are removed ONLY by their markers
-- ('[TEST]' titles/names, raw_file_path='test-seed'), never by "authored by admin"
-- (so your real data is untouched). Reference data (business_lines, permissions,
-- role_permissions, app_settings, departments) is never touched.
-- ============================================================================

begin;

-- Throwaway test users to DELETE (the 5 @tss.test only — NOT the admin gmail).
create temp table _tu5 on commit drop as
  select id from public.profiles
  where email in ('sectionhead@tss.test','employee1@tss.test',
                  'employee2@tss.test','employee3@tss.test','ceo@tss.test');

-- Test tasks = '[TEST]'-marked, or created_by/assigned to a throwaway test user.
create temp table _tt on commit drop as
  select id from public.tasks
  where title like '[TEST]%'
     or created_by in (select id from _tu5)
     or assignee_id in (select id from _tu5);

-- ── child → parent ──────────────────────────────────────────────────────────
delete from public.task_attachments where task_id in (select id from _tt);
delete from public.task_comments     where task_id in (select id from _tt)
                                         or author_id in (select id from _tu5)
                                         or addressed_by in (select id from _tu5);
delete from public.task_updates       where task_id in (select id from _tt)
                                         or updated_by in (select id from _tu5);

-- notifications: throwaway users' rows, [TEST]-marked rows, and any on a test task.
delete from public.notifications      where user_id in (select id from _tu5)
                                         or task_id in (select id from _tt)
                                         or title like '[TEST]%';

-- performance evaluations: throwaway employees + [TEST]-noted (admin may be the
-- evaluator, so scope by employee/notes — never delete by evaluated_by=admin).
delete from public.performance_evaluations
   where employee_id in (select id from _tu5)
      or evaluation_notes like '[TEST]%';

delete from public.recurring_tasks    where title like '[TEST]%'
                                         or created_by in (select id from _tu5)
                                         or assignee_id in (select id from _tu5);

-- dashboard_snapshots: ONLY the test seed marker / test tasks (uploaded_by may be
-- the real admin, so never scope by uploaded_by).
delete from public.dashboard_snapshots where raw_file_path = 'test-seed'
                                         or task_id in (select id from _tt);

-- audit_logs aren't seeded; clear only those a throwaway test user generated.
delete from public.audit_logs         where actor_id in (select id from _tu5);

delete from public.tasks              where id in (select id from _tt);

-- templates / projects: marker-only (admin may be the creator).
delete from public.task_templates     where name like '[TEST]%';
delete from public.projects           where name like '[TEST]%';

-- Finally the throwaway profiles, then their auth users (profiles.id -> auth.users).
delete from public.profiles           where id in (select id from _tu5);
delete from auth.users
   where email in ('sectionhead@tss.test','employee1@tss.test',
                   'employee2@tss.test','employee3@tss.test','ceo@tss.test');

-- ── Verification: zero remaining test rows + reference tables intact ────────
select '== remaining test rows (expect all 0) ==' as section;
select 'tasks[TEST]'      o, count(*) n from public.tasks where title like '[TEST]%'
union all select 'projects[TEST]',      count(*) from public.projects where name like '[TEST]%'
union all select 'templates[TEST]',     count(*) from public.task_templates where name like '[TEST]%'
union all select 'recurring[TEST]',     count(*) from public.recurring_tasks where title like '[TEST]%'
union all select 'snapshots[test-seed]',count(*) from public.dashboard_snapshots where raw_file_path='test-seed'
union all select 'notifications[TEST]', count(*) from public.notifications where title like '[TEST]%'
union all select 'perf_evals[TEST]',    count(*) from public.performance_evaluations where evaluation_notes like '[TEST]%'
union all select 'throwaway_profiles',  count(*) from public.profiles where email in
   ('sectionhead@tss.test','employee1@tss.test','employee2@tss.test','employee3@tss.test','ceo@tss.test')
union all select 'throwaway_auth_users',count(*) from auth.users where email in
   ('sectionhead@tss.test','employee1@tss.test','employee2@tss.test','employee3@tss.test','ceo@tss.test')
order by o;

select '== admin account preserved (expect 1) + reference tables UNTOUCHED ==' as section;
select 'admin_profile'    o, count(*) n from public.profiles where email='tss.bc2026@gmail.com'
union all select 'business_lines',   count(*) from public.business_lines
union all select 'permissions',      count(*) from public.permissions
union all select 'role_permissions', count(*) from public.role_permissions
union all select 'departments',      count(*) from public.departments
union all select 'app_settings',     count(*) from public.app_settings
order by o;

commit;
