-- ============================================================================
-- TSS Planner — COMPREHENSIVE TEST SEED  (supabase/sample-data/full-test-seed.sql)
-- ----------------------------------------------------------------------------
-- Idempotent, fully tagged, fully removable (see full-test-teardown.sql).
-- Every seeded row is marked so teardown targets it precisely:
--   • task / project / template / recurring titles & names start with '[TEST] '
--   • dashboard_snapshots.raw_file_path = 'test-seed'
--   • notifications titles start with '[TEST] '
--   • performance_evaluations.evaluation_notes starts with '[TEST] '
--   • all children tie to the six @tss.test / admin test-user profiles
--
-- PREREQUISITE (do these in the Supabase Dashboard FIRST — see FULL_TEST_PLAN.md):
--   1. Temporarily widen the allow-list:
--        update public.app_settings set value =
--          'saptco.com.sa,tss.bc2026@gmail.com,ahbrika@gmail.com,tss.test'
--          where key='signup_allowed_domains';
--   2. Authentication → Add User (AUTO-CONFIRM, password Test1234!) for:
--        sectionhead@tss.test, employee1@tss.test, employee2@tss.test,
--        employee3@tss.test, ceo@tss.test     (admin = tss.bc2026@gmail.com)
--   3. Restore the locked allow-list:
--        update public.app_settings set value =
--          'saptco.com.sa,tss.bc2026@gmail.com,ahbrika@gmail.com'
--          where key='signup_allowed_domains';
--   The users persist after narrowing (handle_new_user fires on insert only).
--
-- NOTE on the privilege guard: this seed sets other users' role/account_status.
-- guard_profile_privileges() returns early when auth.uid() IS NULL (server/SQL
-- context), and the Supabase SQL editor runs as the owner with no JWT, so the
-- UPDATE is permitted directly — no session_replication_role bracket is needed.
-- (Fallback if ever run under a JWT: wrap the profile UPDATE in
--  `set session_replication_role=replica;` … `reset session_replication_role;`.)
--
-- CANNOT be seeded (do manually — noted in the plan): task attachments + the
-- weekly .xlsx upload (need Storage files), audit_logs (created by performing
-- status changes), and email/password-reset (SMTP not configured).
-- ============================================================================

begin;

-- Re-runnable: resolve the test users, then clear any PRIOR test DATA (markers
-- + test ids) child→parent, KEEPING the user profiles/auth rows.
create temp table _tu on commit drop as
  select email, id from public.profiles
  where email in ('tss.bc2026@gmail.com','sectionhead@tss.test',
                  'employee1@tss.test','employee2@tss.test',
                  'employee3@tss.test','ceo@tss.test');

do $$
begin
  if (select count(*) from _tu) < 6 then
    raise exception
      'Only % of 6 test users found. Create all six in Supabase Auth first (see header).',
      (select count(*) from _tu);
  end if;
end $$;

-- idempotent cleanup of prior test DATA (not the profiles/users)
delete from public.task_attachments a using public.tasks t
  where a.task_id = t.id and t.title like '[TEST]%';
delete from public.task_comments c using public.tasks t
  where c.task_id = t.id and t.title like '[TEST]%';
delete from public.task_updates u using public.tasks t
  where u.task_id = t.id and t.title like '[TEST]%';
delete from public.notifications
  where title like '[TEST]%' and user_id in (select id from _tu);
delete from public.performance_evaluations
  where evaluation_notes like '[TEST]%' and employee_id in (select id from _tu);
delete from public.recurring_tasks where title like '[TEST]%';
delete from public.tasks where title like '[TEST]%';
delete from public.task_templates where name like '[TEST]%';
delete from public.projects where name like '[TEST]%';
delete from public.dashboard_snapshots where raw_file_path = 'test-seed';

-- ── 1. Test-user roles + activate (guard self-bypasses; auth.uid() is null) ──
update public.profiles set role='admin',        account_status='active', is_active=true, job_title='Department Admin'   where email='tss.bc2026@gmail.com';
update public.profiles set role='section_head', account_status='active', is_active=true, job_title='Section Head'       where email='sectionhead@tss.test';
update public.profiles set role='employee',     account_status='active', is_active=true, job_title='Consultant'         where email='employee1@tss.test';
update public.profiles set role='employee',     account_status='active', is_active=true, job_title='Consultant'         where email='employee2@tss.test';
update public.profiles set role='employee',     account_status='active', is_active=true, job_title='Analyst'            where email='employee3@tss.test';
update public.profiles set role='ceo',          account_status='active', is_active=true, job_title='Chief Executive'    where email='ceo@tss.test';

-- ── 2. Projects (2 active + 1 inactive) ─────────────────────────────────────
insert into public.projects (name, business_line_id, is_active) values
  ('[TEST] Platform Rebuild',  (select id from public.business_lines where name='TSS'),            true),
  ('[TEST] Fleet Telematics',  (select id from public.business_lines where name='Merapp'),         true),
  ('[TEST] Legacy Archive',    (select id from public.business_lines where name='ARTC'),           false);

-- ── 3. Task templates ───────────────────────────────────────────────────────
insert into public.task_templates (name, title, description, priority, business_line_id, estimated_effort_hours, is_active, created_by) values
  ('[TEST] Weekly Status Report', 'Weekly status report', 'Compile and circulate the weekly status.', 'medium',
     (select id from public.business_lines where name='TSS'), 4, true, (select id from _tu where email='sectionhead@tss.test')),
  ('[TEST] Incident Review',      'Incident review',      'Root-cause review for a production incident.', 'high',
     (select id from public.business_lines where name='Merapp'), 6, true, (select id from _tu where email='tss.bc2026@gmail.com'));

-- ── 4. Tasks — all 12 statuses, 4 priorities, 4 lines, spread Jan→Jun 2026 ──
--    task_no auto-generates via the set_task_no trigger (TSS-BC-2026-NNNN).
insert into public.tasks
  (title, description, status, priority, business_line_id, assignee_id, created_by,
   created_at, due_date, completed_at, closure_summary, quality_rating, sharepoint_url,
   task_category, project_id, progress_percentage)
select
  v.title, 'Seed task for manual QA.', v.status::public.task_status, v.priority::public.task_priority,
  (select id from public.business_lines where name = v.bl),
  (select id from _tu where email = v.assignee),
  (select id from _tu where email = v.creator),
  v.created_at::timestamptz, v.due_date::date, v.completed_at::timestamptz,
  v.closure, v.rating, v.sp, v.tcat,
  case when v.tcat = 'project'
       then (select id from public.projects where name = v.project) end,
  v.progress
from (values
  -- title, status, priority, bl, assignee, creator, created_at, due_date, completed_at, closure, rating, sharepoint, task_category, project, progress
  ('[TEST] Jan completed on-time (TSS)',        'completed','high',    'TSS',            'employee1@tss.test','sectionhead@tss.test','2026-01-06 09:00+03','2026-01-20','2026-01-18 14:00+03','Delivered on schedule.',5, null,                                              'department', null,                       100),
  ('[TEST] Jan completed LATE (Merapp)',        'completed','medium',  'Merapp',         'employee2@tss.test','sectionhead@tss.test','2026-01-08 09:00+03','2026-01-15','2026-01-25 16:00+03','Closed after a delay.',  3, null,                                              'department', null,                       100),
  ('[TEST] Jan cancelled (ARTC)',               'cancelled','low',     'ARTC',           'employee3@tss.test','sectionhead@tss.test','2026-01-12 09:00+03', null,        null,                  null,                     null,null,                                            'department', null,                         0),
  ('[TEST] Jan rejected (Driving School)',      'rejected','low',      'Driving School', 'employee1@tss.test','sectionhead@tss.test','2026-01-20 09:00+03', null,        null,                  null,                     null,null,                                            'department', null,                         0),
  ('[TEST] Feb approved (TSS)',                 'approved','medium',   'TSS',            'employee2@tss.test','sectionhead@tss.test','2026-02-03 09:00+03','2026-03-15', null,                  null,                     null,null,                                            'department', null,                        10),
  ('[TEST] Feb assigned project (Merapp)',      'assigned','high',     'Merapp',         'employee3@tss.test','sectionhead@tss.test','2026-02-10 09:00+03','2026-02-28', null,                  null,                     null,'https://contoso.sharepoint.com/sites/merapp',     'project',    '[TEST] Fleet Telematics',  20),
  ('[TEST] Feb completed on-time (ARTC)',       'completed','critical','ARTC',           'employee1@tss.test','sectionhead@tss.test','2026-02-05 09:00+03','2026-02-20','2026-02-19 11:00+03','Completed early.',       4, null,                                              'department', null,                       100),
  ('[TEST] Feb draft (TSS)',                    'draft','low',         'TSS',            'employee3@tss.test','employee3@tss.test',  '2026-02-18 09:00+03', null,        null,                  null,                     null,null,                                            'department', null,                         0),
  ('[TEST] Mar in progress (TSS)',              'in_progress','high',  'TSS',            'employee2@tss.test','sectionhead@tss.test','2026-03-02 09:00+03','2026-03-31', null,                  null,                     null,null,                                            'department', null,                        45),
  ('[TEST] Mar pending update (Merapp)',        'pending_update','medium','Merapp',      'employee3@tss.test','sectionhead@tss.test','2026-03-09 09:00+03','2026-03-25', null,                  null,                     null,null,                                            'department', null,                        60),
  ('[TEST] Mar returned (Driving School)',      'returned_for_modification','low','Driving School','employee1@tss.test','sectionhead@tss.test','2026-03-15 09:00+03','2026-03-28', null,         null,                     null,null,                                            'department', null,                        30),
  ('[TEST] Mar completed LATE (TSS)',           'completed','medium',  'TSS',            'employee2@tss.test','sectionhead@tss.test','2026-03-04 09:00+03','2026-03-10','2026-03-20 15:00+03','Closed late.',           3, null,                                              'department', null,                       100),
  ('[TEST] Apr pending review project (ARTC)',  'pending_review','high','ARTC',          'employee1@tss.test','sectionhead@tss.test','2026-04-02 09:00+03','2026-04-25', null,                  null,                     null,'https://contoso.sharepoint.com/sites/artc',       'project',    '[TEST] Platform Rebuild',  90),
  ('[TEST] Apr reopened (Merapp)',              'reopened','medium',   'Merapp',         'employee3@tss.test','sectionhead@tss.test','2026-04-08 09:00+03','2026-04-30', null,                  null,                     null,null,                                            'department', null,                        50),
  ('[TEST] Apr pending approval (Driving School)','pending_approval','low','Driving School','employee2@tss.test','employee2@tss.test','2026-04-12 09:00+03','2026-05-10', null,                 null,                     null,null,                                            'department', null,                         0),
  ('[TEST] Apr OVERDUE in progress (TSS)',      'in_progress','critical','TSS',          'employee1@tss.test','sectionhead@tss.test','2026-04-15 09:00+03','2026-04-30', null,                  null,                     null,null,                                            'department', null,                        70),
  ('[TEST] May OVERDUE assigned (Merapp)',      'assigned','high',     'Merapp',         'employee2@tss.test','sectionhead@tss.test','2026-05-04 09:00+03','2026-05-20', null,                  null,                     null,null,                                            'department', null,                        15),
  ('[TEST] May in progress project (ARTC)',     'in_progress','medium','ARTC',           'employee3@tss.test','sectionhead@tss.test','2026-05-10 09:00+03','2026-06-30', null,                  null,                     null,null,                                            'project',    '[TEST] Platform Rebuild',  40),
  ('[TEST] May completed on-time (Driving School)','completed','low',  'Driving School', 'employee1@tss.test','sectionhead@tss.test','2026-05-06 09:00+03','2026-05-15','2026-05-14 12:00+03','Done.',                  4, null,                                              'department', null,                       100),
  ('[TEST] May pending update (Driving School)','pending_update','high','Driving School','employee2@tss.test','sectionhead@tss.test','2026-05-22 09:00+03','2026-06-05', null,                  null,                     null,null,                                            'department', null,                        65),
  ('[TEST] Jun in progress (TSS)',              'in_progress','high',  'TSS',            'employee1@tss.test','sectionhead@tss.test','2026-06-02 09:00+03','2026-06-30', null,                  null,                     null,null,                                            'department', null,                        55),
  ('[TEST] Jun pending review (Merapp)',        'pending_review','critical','Merapp',    'employee2@tss.test','sectionhead@tss.test','2026-06-03 09:00+03','2026-06-20', null,                  null,                     null,'https://contoso.sharepoint.com/sites/merapp2',    'department', null,                        95),
  ('[TEST] Jun OVERDUE assigned (ARTC)',        'assigned','medium',   'ARTC',           'employee3@tss.test','sectionhead@tss.test','2026-06-04 09:00+03','2026-06-10', null,                  null,                     null,null,                                            'department', null,                        25),
  ('[TEST] Jun pending approval (Driving School)','pending_approval','low','Driving School','employee1@tss.test','employee1@tss.test','2026-06-09 09:00+03','2026-06-25', null,                 null,                     null,null,                                            'department', null,                         0)
) as v(title,status,priority,bl,assignee,creator,created_at,due_date,completed_at,closure,rating,sp,tcat,project,progress);

-- ── 5. Progress updates (collaboration + timeline), dated across the period ──
insert into public.task_updates (task_id, updated_by, progress_percentage, status_update_comment, next_action, challenges_blockers, created_at)
select t.id, t.assignee_id, v.pct, v.cmt, v.nxt, v.blk, v.at::timestamptz
from (values
  ('[TEST] Mar in progress (TSS)',           40,'Discovery complete; build started.','Wire up the API.',  null,                        '2026-03-12 10:00+03'),
  ('[TEST] Mar in progress (TSS)',           45,'API integrated; QA pending.',       'Begin QA.',         'Waiting on test data.',     '2026-03-26 10:00+03'),
  ('[TEST] Apr pending review project (ARTC)',90,'Feature complete; submitted.',      'Await review.',     null,                        '2026-04-22 14:00+03'),
  ('[TEST] May in progress project (ARTC)',  40,'Data model agreed.',                 'Implement ingest.', 'Vendor SLA risk.',          '2026-05-18 09:30+03'),
  ('[TEST] Jun in progress (TSS)',           55,'Halfway through the migration.',     'Migrate module C.', null,                        '2026-06-09 11:00+03')
) as v(title,pct,cmt,nxt,blk,at)
join public.tasks t on t.title = v.title;

-- ── 6. Comments (incl. a CEO Office Comment) ────────────────────────────────
insert into public.task_comments (task_id, author_id, comment_role, comment_type, comment_text, created_at)
select t.id, (select id from _tu where email=v.author), v.role::public.user_role, v.ctype::public.comment_type_enum, v.txt, v.at::timestamptz
from (values
  ('[TEST] Mar in progress (TSS)',            'sectionhead@tss.test','section_head','task_specific',     'Please prioritise the API integration.', '2026-03-13 09:00+03'),
  ('[TEST] Mar in progress (TSS)',            'employee2@tss.test',  'employee',    'task_specific',     'Understood — on it today.',               '2026-03-13 12:00+03'),
  ('[TEST] Apr pending review project (ARTC)','ceo@tss.test',        'ceo',         'ceo_office_comment','CEO Office: ensure ARTC sign-off before close.','2026-04-23 10:00+03'),
  ('[TEST] Jun pending review (Merapp)',      'sectionhead@tss.test','section_head','task_specific',     'Looks good — reviewing now.',             '2026-06-04 09:00+03')
) as v(title,author,role,ctype,txt,at)
join public.tasks t on t.title = v.title;

-- ── 7. Recurring tasks (1 active + 1 soft-deleted, for restore) ─────────────
insert into public.recurring_tasks (title, description, category, business_line_id, assignee_id, priority, frequency, start_date, next_generation_date, estimated_effort_hours, is_active, created_by, deleted_at)
values
  ('[TEST] Weekly status report', 'Auto-generated weekly status task.', 'Reporting',
     (select id from public.business_lines where name='TSS'),
     (select id from _tu where email='employee1@tss.test'), 'medium', 'weekly',
     '2026-01-05', current_date, 4, true,
     (select id from _tu where email='sectionhead@tss.test'), null),
  ('[TEST] Monthly archive', 'Soft-deleted recurring task (restore test).', 'Maintenance',
     (select id from public.business_lines where name='Merapp'),
     (select id from _tu where email='employee2@tss.test'), 'low', 'monthly',
     '2026-01-01', current_date, 2, false,
     (select id from _tu where email='sectionhead@tss.test'), now());

-- ── 8. Performance evaluations (quarterly periods — the app uses YYYY-Qn) ────
insert into public.performance_evaluations
  (employee_id, period, assigned_tasks_count, completed_tasks_count, delayed_tasks_count,
   avg_completion_days, update_frequency_score, quality_avg_rating, returned_tasks_count,
   workload_level, overall_score, evaluated_by, evaluation_notes)
select (select id from _tu where email=v.emp), v.period, v.assigned, v.completed, v.delayed,
       v.avgdays, v.freq, v.qual, v.returned, v.workload, v.score,
       (select id from _tu where email=v.evaluator), v.notes
from (values
  ('employee1@tss.test','2025-Q4', 10, 9, 1, 3.2, 4.5, 4.6, 0, 'medium', 4.5,'sectionhead@tss.test','[TEST] Strong quarter.'),
  ('employee1@tss.test','2026-Q1', 12,10, 2, 3.6, 4.2, 4.4, 1, 'high',   4.2,'sectionhead@tss.test','[TEST] Heavy load, solid delivery.'),
  ('employee1@tss.test','2026-Q2',  9, 6, 2, 4.1, 4.0, 4.3, 1, 'medium', 4.0,'tss.bc2026@gmail.com','[TEST] In progress.'),
  ('employee2@tss.test','2025-Q4',  8, 6, 2, 5.0, 3.6, 3.8, 1, 'medium', 3.6,'sectionhead@tss.test','[TEST] Some delays.'),
  ('employee2@tss.test','2026-Q1', 11, 8, 3, 5.4, 3.4, 3.7, 2, 'high',   3.4,'sectionhead@tss.test','[TEST] Watch the backlog.'),
  ('employee2@tss.test','2026-Q2',  7, 4, 3, 5.8, 3.2, 3.6, 1, 'high',   3.2,'tss.bc2026@gmail.com','[TEST] Backlog growing.'),
  ('employee3@tss.test','2025-Q4',  6, 6, 0, 2.8, 4.8, 4.7, 0, 'low',    4.7,'sectionhead@tss.test','[TEST] Excellent.'),
  ('employee3@tss.test','2026-Q1',  7, 6, 1, 3.0, 4.6, 4.5, 0, 'low',    4.5,'sectionhead@tss.test','[TEST] Reliable.'),
  ('employee3@tss.test','2026-Q2',  5, 3, 1, 3.3, 4.4, 4.4, 0, 'medium', 4.3,'tss.bc2026@gmail.com','[TEST] On track.')
) as v(emp,period,assigned,completed,delayed,avgdays,freq,qual,returned,workload,score,evaluator,notes);

-- ── 9. Unread notifications batch (for employee1's bell + bulk actions) ─────
insert into public.notifications (user_id, type, title, message, is_read, created_at)
select (select id from _tu where email='employee1@tss.test'), v.t::public.notification_type, v.title, v.msg, false, v.at::timestamptz
from (values
  ('task_assigned','[TEST] Task assigned',         'You were assigned a new task.',          '2026-06-10 09:00+03'),
  ('task_review_requested','[TEST] Review requested','A task you own needs review.',          '2026-06-11 10:00+03'),
  ('comment_added','[TEST] New comment',           'A new comment was added to your task.',  '2026-06-12 11:00+03'),
  ('task_returned','[TEST] Task returned',         'A task was returned for modification.',  '2026-06-12 15:00+03'),
  ('system','[TEST] System notice',               'Scheduled maintenance this weekend.',    '2026-06-13 08:00+03'),
  ('task_completed','[TEST] Task completed',       'A task you follow was completed.',       '2026-06-13 16:00+03')
) as v(t,title,msg,at);

-- ── 10. A test weekly dashboard snapshot (raw_file_path='test-seed', always-live)
--     Minimal but schema-valid DASHBOARD_DATA so /dashboard/weekly has data
--     without the manual .xlsx upload. (Zod-validated against dashboardDataSchema.)
insert into public.dashboard_snapshots (week_start, data, uploaded_by, task_id, raw_file_path)
values (
  '2026-06-08',
  '{"meta":{"title":"Business Lines · Weekly Dashboard","subtitle":"[TEST] seed snapshot","lastRefreshed":"2026-06-08","weekStart":"2026-06-08","periods":[{"id":"week","label":"This Week"},{"id":"mtd","label":"MTD"},{"id":"ytd","label":"YTD"}],"defaultBl":"tss","defaultPeriod":"week","footLeft":"[TEST] seed","footRight":"[TEST]"},"businessLines":[{"id":"tss","name":"TSS · Consolidated","accent":"#762651","isSample":true,"tagline":"[TEST] consolidated","kpiGroups":[{"num":"01","title":"Revenue","accent":"#762651","cols":3,"kpis":[{"id":"t-rev","label":"Total Revenue","lead":true,"tag":"GROUP","values":{"week":"SAR 500K","mtd":"SAR 1.5M","ytd":"SAR 7M"},"delta":{"dir":"up","text":"+8%"},"rag":"green","note":"YTD"},{"id":"t-billed","label":"Billed","values":{"week":"SAR 400K","mtd":"SAR 1.2M","ytd":"SAR 5.5M"},"delta":{"dir":"flat","text":"78%"},"rag":"amber"},{"id":"t-margin","label":"Margin","values":{"week":"31%","mtd":"30%","ytd":"29%"},"delta":{"dir":"up","text":"+2"},"rag":"green","target":{"value":29,"target":32,"suffix":"%"}}]}],"charts":[{"id":"tss-trend","type":"line","title":"Weekly Revenue Trend","subtitle":"5 weeks","valueKind":"currency","span":"wide","categories":["W17","W18","W19","W20","W21"],"series":[{"name":"merapp","color":"#EE8742","data":[86,91,88,95,98]},{"name":"DS","color":"#3D8540","data":[58,61,60,63,64]}]},{"id":"tss-mix","type":"doughnut","title":"Revenue by Line","subtitle":"YTD","valueKind":"currency","span":"half","segments":[{"label":"merapp","value":1742724,"color":"#EE8742"},{"label":"DS","value":1340000,"color":"#3D8540"}]}],"tables":[{"id":"tss-sc","title":"Scorecard","meta":"YTD","columns":[{"key":"name","label":"Line","kind":"text","strong":true},{"key":"rev","label":"Revenue","align":"right","kind":"currency"},{"key":"status","label":"Status","kind":"rag"}],"rows":[{"name":"merapp","rev":1742724,"status":{"label":"On Track","level":"green"}},{"name":"DS","rev":1340000,"status":{"label":"On Track","level":"green"}}]}]},{"id":"merapp","name":"merapp","accent":"#EE8742","isSample":true,"tagline":"[TEST]","kpiGroups":[{"num":"01","title":"Revenue","accent":"#EE8742","cols":2,"kpis":[{"id":"m-rev","label":"Revenue","values":{"week":"SAR 98K","mtd":"SAR 312K","ytd":"SAR 1.74M"},"delta":{"dir":"up","text":"+12%"},"rag":"green"},{"id":"m-cards","label":"Job Cards","values":{"week":"38","mtd":"94","ytd":"1,261"},"delta":{"dir":"down","text":"-2"},"rag":"amber"}]}],"charts":[],"tables":[]}]}'::jsonb,
  (select id from _tu where email='tss.bc2026@gmail.com'),
  null,
  'test-seed'
);

-- ── Verification (full-period spread + per-feature presence) ────────────────
select '== tasks per month (expect every month Jan→Jun) ==' as section;
select to_char(date_trunc('month', created_at), 'YYYY-MM') as month, count(*) as tasks
from public.tasks where title like '[TEST]%' group by 1 order by 1;

select '== distinct statuses present (expect 12) ==' as section;
select count(distinct status) as distinct_statuses from public.tasks where title like '[TEST]%';

select '== overdue test tasks (due_date < today, still active) ==' as section;
select count(*) as overdue_tasks from public.tasks
where title like '[TEST]%' and due_date < current_date
  and status not in ('completed','cancelled','rejected');

select '== seeded row counts ==' as section;
select 'projects' o, count(*) n from public.projects where name like '[TEST]%'
union all select 'templates', count(*) from public.task_templates where name like '[TEST]%'
union all select 'tasks', count(*) from public.tasks where title like '[TEST]%'
union all select 'task_updates', count(*) from public.task_updates u join public.tasks t on t.id=u.task_id where t.title like '[TEST]%'
union all select 'task_comments', count(*) from public.task_comments c join public.tasks t on t.id=c.task_id where t.title like '[TEST]%'
union all select 'recurring', count(*) from public.recurring_tasks where title like '[TEST]%'
union all select 'perf_evals', count(*) from public.performance_evaluations where evaluation_notes like '[TEST]%'
union all select 'notifications', count(*) from public.notifications where title like '[TEST]%'
union all select 'snapshots', count(*) from public.dashboard_snapshots where raw_file_path='test-seed'
order by o;

commit;
