-- ============================================================================
-- TSS Planner — TEST TEARDOWN  (supabase/sample-data/full-test-teardown.sql)
-- ----------------------------------------------------------------------------
-- MARKER-ONLY · USER-PRESERVING. Removes EVERYTHING created by full-test-seed.sql
-- and NOTHING else, in proven FK-safe child→parent order, in ONE transaction
-- (any error rolls the whole thing back). Idempotent: safe to run twice.
--
-- CRITICAL SAFETY: the six attributed accounts are REAL users that may carry
-- REAL data. This script:
--   • deletes ONLY rows carrying a seed marker — never by user id;
--       tasks / projects / templates  → '[TEST] ' title/name prefix
--       recurring_tasks               → '[TEST] ' title prefix
--       notifications                 → '[TEST] ' title prefix
--       performance_evaluations       → '[TEST] ' evaluation_notes prefix
--       dashboard_snapshots           → raw_file_path = 'test-seed'
--       task_updates / task_comments / task_attachments → scoped via their
--         '[TEST] ' parent task ONLY (these tables have no own marker field)
--   • NEVER deletes from public.profiles or auth.users — no user is removed;
--   • NEVER touches audit_logs (immutable history; not seeded);
--   • NEVER touches reference data (business_lines, permissions,
--     role_permissions, app_settings, departments).
-- A user's REAL (non-marked) tasks, notifications, evaluations, comments, etc.
-- are therefore left completely untouched.
-- ============================================================================

begin;

-- The set of test tasks = '[TEST] '-titled tasks ONLY (marker, never user id).
create temp table _tt on commit drop as
  select id from public.tasks where title like '[TEST]%';

-- ── child → parent ──────────────────────────────────────────────────────────
-- Children of test tasks: scope STRICTLY by the '[TEST]' parent task id, so a
-- real comment/update/attachment on a real task is never removed.
delete from public.task_attachments where task_id in (select id from _tt);
delete from public.task_comments     where task_id in (select id from _tt);
delete from public.task_updates       where task_id in (select id from _tt);

-- notifications: marker-titled rows only (real notifications are untouched).
-- Note: notifications.task_id is ON DELETE CASCADE, but we delete by marker
-- here so a real notification can never ride along on a test task.
delete from public.notifications where title like '[TEST]%';

-- performance evaluations: marker-noted rows only (the evaluator may be a real
-- user — admin/section_head — so we NEVER scope by evaluated_by/employee_id).
delete from public.performance_evaluations where evaluation_notes like '[TEST]%';

-- dashboard_snapshots: the test-seed marker only (uploaded_by is the real admin,
-- so we NEVER scope by uploaded_by). task_id is ON DELETE SET NULL, harmless.
delete from public.dashboard_snapshots where raw_file_path = 'test-seed';

-- recurring tasks: marker-titled only.
delete from public.recurring_tasks where title like '[TEST]%';

-- task templates: marker-named only (creator is the real admin). No FK from
-- tasks → task_templates, so order is flexible; kept before tasks by convention.
delete from public.task_templates where name like '[TEST]%';

-- now the test tasks themselves (children already gone).
delete from public.tasks where id in (select id from _tt);

-- projects: marker-named only (creator may be a real user).
delete from public.projects where name like '[TEST]%';

-- NOTE: public.profiles and auth.users are intentionally NEVER touched here.
-- NOTE: public.audit_logs is intentionally NEVER touched here.

-- ── Verification A: zero remaining MARKED rows (expect every count 0) ───────
select '== remaining marked test rows (expect all 0) ==' as section;
select 'tasks[TEST]'       o, count(*) n from public.tasks where title like '[TEST]%'
union all select 'projects[TEST]',       count(*) from public.projects where name like '[TEST]%'
union all select 'templates[TEST]',      count(*) from public.task_templates where name like '[TEST]%'
union all select 'recurring[TEST]',      count(*) from public.recurring_tasks where title like '[TEST]%'
union all select 'snapshots[test-seed]', count(*) from public.dashboard_snapshots where raw_file_path='test-seed'
union all select 'notifications[TEST]',  count(*) from public.notifications where title like '[TEST]%'
union all select 'perf_evals[TEST]',     count(*) from public.performance_evaluations where evaluation_notes like '[TEST]%'
union all select 'updates_on_test',      count(*) from public.task_updates u join public.tasks t on t.id=u.task_id where t.title like '[TEST]%'
union all select 'comments_on_test',     count(*) from public.task_comments c join public.tasks t on t.id=c.task_id where t.title like '[TEST]%'
order by o;

-- ── Verification B: all SIX real users still exist (expect found=6) ─────────
select '== real users preserved (expect found=6) + reference tables UNTOUCHED ==' as section;
select 'real_users_found' o, count(*)::text n from public.profiles where email in
   ('tss.bc2026@gmail.com','brikaam@saptco.com.sa','alzahranika@saptco.com.sa',
    'aldosarimb@saptco.com.sa','abdullahqo@saptco.com.sa','alsuhalirf@saptco.com.sa')
union all select 'auth_users_found', count(*)::text from auth.users where email in
   ('tss.bc2026@gmail.com','brikaam@saptco.com.sa','alzahranika@saptco.com.sa',
    'aldosarimb@saptco.com.sa','abdullahqo@saptco.com.sa','alsuhalirf@saptco.com.sa')
union all select 'business_lines',   count(*)::text from public.business_lines
union all select 'permissions',      count(*)::text from public.permissions
union all select 'role_permissions', count(*)::text from public.role_permissions
union all select 'departments',      count(*)::text from public.departments
union all select 'app_settings',     count(*)::text from public.app_settings
order by o;

commit;
