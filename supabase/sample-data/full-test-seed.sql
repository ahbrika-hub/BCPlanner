-- ============================================================================
-- TSS Planner — COMPREHENSIVE TEST SEED  (supabase/sample-data/full-test-seed.sql)
-- ----------------------------------------------------------------------------
-- Attributes a fully-tagged, fully-removable test dataset to the SIX EXISTING
-- REAL users (resolved by email). It does NOT create users and NEVER alters any
-- profile (no role / account_status / is_active changes). Pair with the
-- MARKER-ONLY teardown (full-test-teardown.sql).
--
-- REAL users (must already exist, with these roles already set):
--   admin         tss.bc2026@gmail.com
--   section_head  brikaam@saptco.com.sa        (Ahmed Brika)
--   ceo           alzahranika@saptco.com.sa    (Khalid Alzahrani)
--   employee #1   aldosarimb@saptco.com.sa     (meshari)
--   employee #2   abdullahqo@saptco.com.sa     (Qutuf)
--   employee #3   alsuhalirf@saptco.com.sa     (Reyouf)
--
-- EVERY seeded row carries a removable marker so the teardown targets it by
-- marker ALONE (never by user id):
--   tasks / projects / templates  → '[TEST] ' title/name prefix
--   recurring_tasks               → '[TEST] ' title prefix
--   notifications                 → '[TEST] ' title prefix
--   performance_evaluations       → '[TEST] ' evaluation_notes prefix
--   dashboard_snapshots           → raw_file_path = 'test-seed'
--   task_updates / task_comments  → tied to a '[TEST] ' parent task (no own field)
-- Every table seeded HAS a safe marker field — none had to be skipped.
--
-- CANNOT be seeded (do manually — see FULL_TEST_PLAN.md): task attachments + the
-- weekly .xlsx upload (need Storage files); audit_logs (created by performing
-- status changes); email / password-reset (no SMTP).
--
-- Idempotent: re-running first clears prior marked rows, then re-inserts.
-- ============================================================================

begin;

-- Resolve the six real users by email. Guard: ALL six must exist, else abort
-- (we never create users; a typo must fail loudly, not silently mis-attribute).
create temp table _tu on commit drop as
  select email, id from public.profiles
  where email in ('tss.bc2026@gmail.com','brikaam@saptco.com.sa',
                  'alzahranika@saptco.com.sa','aldosarimb@saptco.com.sa',
                  'abdullahqo@saptco.com.sa','alsuhalirf@saptco.com.sa');

do $$
begin
  if (select count(*) from _tu) < 6 then
    raise exception
      'Only % of 6 expected users found in public.profiles. Check the emails; this seed does NOT create users.',
      (select count(*) from _tu);
  end if;
end $$;

-- Idempotent cleanup of prior test DATA — MARKER-ONLY (never touches users/profiles).
delete from public.task_attachments a using public.tasks t
  where a.task_id = t.id and t.title like '[TEST]%';
delete from public.task_comments c using public.tasks t
  where c.task_id = t.id and t.title like '[TEST]%';
delete from public.task_updates u using public.tasks t
  where u.task_id = t.id and t.title like '[TEST]%';
delete from public.notifications            where title like '[TEST]%';
delete from public.performance_evaluations  where evaluation_notes like '[TEST]%';
delete from public.recurring_tasks          where title like '[TEST]%';
delete from public.dashboard_snapshots      where raw_file_path = 'test-seed';
delete from public.tasks                    where title like '[TEST]%';
delete from public.task_templates           where name like '[TEST]%';
delete from public.projects                 where name like '[TEST]%';

-- ── 1. Projects (2 active + 1 inactive) ─────────────────────────────────────
insert into public.projects (name, business_line_id, is_active) values
  ('[TEST] Platform Rebuild',  (select id from public.business_lines where name='TSS'),    true),
  ('[TEST] Fleet Telematics',  (select id from public.business_lines where name='Merapp'), true),
  ('[TEST] Legacy Archive',    (select id from public.business_lines where name='ARTC'),   false);

-- ── 2. Task templates (real admin is the creator; used by the create-from-template flow)
insert into public.task_templates (name, title, description, priority, business_line_id, estimated_effort_hours, is_active, created_by) values
  ('[TEST] Weekly Status Report', 'Weekly status report', 'Compile and circulate the weekly status.', 'medium',
     (select id from public.business_lines where name='TSS'), 4, true, (select id from _tu where email='tss.bc2026@gmail.com')),
  ('[TEST] Incident Review',      'Incident review',      'Root-cause review for a production incident.', 'high',
     (select id from public.business_lines where name='Merapp'), 6, true, (select id from _tu where email='tss.bc2026@gmail.com'));

-- ── 3. Tasks — all 12 statuses, 4 priorities, 4 lines, spread Jan→Jun 2026 ──
--    task_no auto-generates (TSS-BC-2026-NNNN). created_by/assignee = real users.
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
  ('[TEST] Jan completed on-time (TSS)',        'completed','high',    'TSS',            'aldosarimb@saptco.com.sa','brikaam@saptco.com.sa','2026-01-06 09:00+03','2026-01-20','2026-01-18 14:00+03','Delivered on schedule.',5, null,                                              'department', null,                       100),
  ('[TEST] Jan completed LATE (Merapp)',        'completed','medium',  'Merapp',         'abdullahqo@saptco.com.sa','brikaam@saptco.com.sa','2026-01-08 09:00+03','2026-01-15','2026-01-25 16:00+03','Closed after a delay.',  3, null,                                              'department', null,                       100),
  ('[TEST] Jan cancelled (ARTC)',               'cancelled','low',     'ARTC',           'alsuhalirf@saptco.com.sa','brikaam@saptco.com.sa','2026-01-12 09:00+03', null,        null,                  null,                     null,null,                                            'department', null,                         0),
  ('[TEST] Jan rejected (Driving School)',      'rejected','low',      'Driving School', 'aldosarimb@saptco.com.sa','brikaam@saptco.com.sa','2026-01-20 09:00+03', null,        null,                  null,                     null,null,                                            'department', null,                         0),
  ('[TEST] Feb approved (TSS)',                 'approved','medium',   'TSS',            'abdullahqo@saptco.com.sa','brikaam@saptco.com.sa','2026-02-03 09:00+03','2026-03-15', null,                  null,                     null,null,                                            'department', null,                        10),
  ('[TEST] Feb assigned project (Merapp)',      'assigned','high',     'Merapp',         'alsuhalirf@saptco.com.sa','brikaam@saptco.com.sa','2026-02-10 09:00+03','2026-02-28', null,                  null,                     null,'https://contoso.sharepoint.com/sites/merapp',     'project',    '[TEST] Fleet Telematics',  20),
  ('[TEST] Feb completed on-time (ARTC)',       'completed','critical','ARTC',           'aldosarimb@saptco.com.sa','brikaam@saptco.com.sa','2026-02-05 09:00+03','2026-02-20','2026-02-19 11:00+03','Completed early.',       4, null,                                              'department', null,                       100),
  ('[TEST] Feb draft (TSS)',                    'draft','low',         'TSS',            'alsuhalirf@saptco.com.sa','alsuhalirf@saptco.com.sa','2026-02-18 09:00+03', null,        null,             null,                     null,null,                                            'department', null,                         0),
  ('[TEST] Mar in progress (TSS)',              'in_progress','high',  'TSS',            'abdullahqo@saptco.com.sa','brikaam@saptco.com.sa','2026-03-02 09:00+03','2026-03-31', null,                  null,                     null,null,                                            'department', null,                        45),
  ('[TEST] Mar pending update (Merapp)',        'pending_update','medium','Merapp',      'alsuhalirf@saptco.com.sa','brikaam@saptco.com.sa','2026-03-09 09:00+03','2026-03-25', null,                  null,                     null,null,                                            'department', null,                        60),
  ('[TEST] Mar returned (Driving School)',      'returned_for_modification','low','Driving School','aldosarimb@saptco.com.sa','brikaam@saptco.com.sa','2026-03-15 09:00+03','2026-03-28', null,          null,                     null,null,                                            'department', null,                        30),
  ('[TEST] Mar completed LATE (TSS)',           'completed','medium',  'TSS',            'abdullahqo@saptco.com.sa','brikaam@saptco.com.sa','2026-03-04 09:00+03','2026-03-10','2026-03-20 15:00+03','Closed late.',           3, null,                                              'department', null,                       100),
  ('[TEST] Apr pending review project (ARTC)',  'pending_review','high','ARTC',          'aldosarimb@saptco.com.sa','brikaam@saptco.com.sa','2026-04-02 09:00+03','2026-04-25', null,                  null,                     null,'https://contoso.sharepoint.com/sites/artc',       'project',    '[TEST] Platform Rebuild',  90),
  ('[TEST] Apr reopened (Merapp)',              'reopened','medium',   'Merapp',         'alsuhalirf@saptco.com.sa','brikaam@saptco.com.sa','2026-04-08 09:00+03','2026-04-30', null,                  null,                     null,null,                                            'department', null,                        50),
  ('[TEST] Apr pending approval (Driving School)','pending_approval','low','Driving School','abdullahqo@saptco.com.sa','abdullahqo@saptco.com.sa','2026-04-12 09:00+03','2026-05-10', null,            null,                     null,null,                                            'department', null,                         0),
  ('[TEST] Apr OVERDUE in progress (TSS)',      'in_progress','critical','TSS',          'aldosarimb@saptco.com.sa','brikaam@saptco.com.sa','2026-04-15 09:00+03','2026-04-30', null,                  null,                     null,null,                                            'department', null,                        70),
  ('[TEST] May OVERDUE assigned (Merapp)',      'assigned','high',     'Merapp',         'abdullahqo@saptco.com.sa','brikaam@saptco.com.sa','2026-05-04 09:00+03','2026-05-20', null,                  null,                     null,null,                                            'department', null,                        15),
  ('[TEST] May in progress project (ARTC)',     'in_progress','medium','ARTC',           'alsuhalirf@saptco.com.sa','brikaam@saptco.com.sa','2026-05-10 09:00+03','2026-06-30', null,                  null,                     null,null,                                            'project',    '[TEST] Platform Rebuild',  40),
  ('[TEST] May completed on-time (Driving School)','completed','low',  'Driving School', 'aldosarimb@saptco.com.sa','brikaam@saptco.com.sa','2026-05-06 09:00+03','2026-05-15','2026-05-14 12:00+03','Done.',                  4, null,                                              'department', null,                       100),
  ('[TEST] May pending update (Driving School)','pending_update','high','Driving School','abdullahqo@saptco.com.sa','brikaam@saptco.com.sa','2026-05-22 09:00+03','2026-06-05', null,                  null,                     null,null,                                            'department', null,                        65),
  ('[TEST] Jun in progress (TSS)',              'in_progress','high',  'TSS',            'aldosarimb@saptco.com.sa','brikaam@saptco.com.sa','2026-06-02 09:00+03','2026-06-30', null,                  null,                     null,null,                                            'department', null,                        55),
  ('[TEST] Jun pending review (Merapp)',        'pending_review','critical','Merapp',    'abdullahqo@saptco.com.sa','brikaam@saptco.com.sa','2026-06-03 09:00+03','2026-06-20', null,                  null,                     null,'https://contoso.sharepoint.com/sites/merapp2',    'department', null,                        95),
  ('[TEST] Jun OVERDUE assigned (ARTC)',        'assigned','medium',   'ARTC',           'alsuhalirf@saptco.com.sa','brikaam@saptco.com.sa','2026-06-04 09:00+03','2026-06-10', null,                  null,                     null,null,                                            'department', null,                        25),
  ('[TEST] Jun pending approval (Driving School)','pending_approval','low','Driving School','aldosarimb@saptco.com.sa','aldosarimb@saptco.com.sa','2026-06-09 09:00+03','2026-06-25', null,           null,                     null,null,                                            'department', null,                         0)
) as v(title,status,priority,bl,assignee,creator,created_at,due_date,completed_at,closure,rating,sp,tcat,project,progress);

-- ── 4. Progress updates (collaboration + timeline), dated across the period ──
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

-- ── 5. Comments (incl. a CEO Office Comment by the real ceo) ────────────────
insert into public.task_comments (task_id, author_id, comment_role, comment_type, comment_text, created_at)
select t.id, (select id from _tu where email=v.author), v.role::public.user_role, v.ctype::public.comment_type_enum, v.txt, v.at::timestamptz
from (values
  ('[TEST] Mar in progress (TSS)',            'brikaam@saptco.com.sa',    'section_head','task_specific',     'Please prioritise the API integration.',        '2026-03-13 09:00+03'),
  ('[TEST] Mar in progress (TSS)',            'abdullahqo@saptco.com.sa', 'employee',    'task_specific',     'Understood — on it today.',                     '2026-03-13 12:00+03'),
  ('[TEST] Apr pending review project (ARTC)','alzahranika@saptco.com.sa','ceo',         'ceo_office_comment','CEO Office: ensure ARTC sign-off before close.','2026-04-23 10:00+03'),
  ('[TEST] Jun pending review (Merapp)',      'brikaam@saptco.com.sa',    'section_head','task_specific',     'Looks good — reviewing now.',                   '2026-06-04 09:00+03')
) as v(title,author,role,ctype,txt,at)
join public.tasks t on t.title = v.title;

-- ── 6. Recurring tasks (1 active + 1 soft-deleted, for restore) ─────────────
insert into public.recurring_tasks (title, description, category, business_line_id, assignee_id, priority, frequency, start_date, next_generation_date, estimated_effort_hours, is_active, created_by, deleted_at)
values
  ('[TEST] Weekly status report', 'Auto-generated weekly status task.', 'Reporting',
     (select id from public.business_lines where name='TSS'),
     (select id from _tu where email='aldosarimb@saptco.com.sa'), 'medium', 'weekly',
     '2026-01-05', current_date, 4, true,
     (select id from _tu where email='brikaam@saptco.com.sa'), null),
  ('[TEST] Monthly archive', 'Soft-deleted recurring task (restore test).', 'Maintenance',
     (select id from public.business_lines where name='Merapp'),
     (select id from _tu where email='abdullahqo@saptco.com.sa'), 'low', 'monthly',
     '2026-01-01', current_date, 2, false,
     (select id from _tu where email='brikaam@saptco.com.sa'), now());

-- ── 7. Performance evaluations (quarterly — every notes row carries the marker)
insert into public.performance_evaluations
  (employee_id, period, assigned_tasks_count, completed_tasks_count, delayed_tasks_count,
   avg_completion_days, update_frequency_score, quality_avg_rating, returned_tasks_count,
   workload_level, overall_score, evaluated_by, evaluation_notes)
select (select id from _tu where email=v.emp), v.period, v.assigned, v.completed, v.delayed,
       v.avgdays, v.freq, v.qual, v.returned, v.workload, v.score,
       (select id from _tu where email=v.evaluator), v.notes
from (values
  ('aldosarimb@saptco.com.sa','2025-Q4', 10, 9, 1, 3.2, 4.5, 4.6, 0, 'medium', 4.5,'brikaam@saptco.com.sa','[TEST] Strong quarter.'),
  ('aldosarimb@saptco.com.sa','2026-Q1', 12,10, 2, 3.6, 4.2, 4.4, 1, 'high',   4.2,'brikaam@saptco.com.sa','[TEST] Heavy load, solid delivery.'),
  ('aldosarimb@saptco.com.sa','2026-Q2',  9, 6, 2, 4.1, 4.0, 4.3, 1, 'medium', 4.0,'tss.bc2026@gmail.com','[TEST] In progress.'),
  ('abdullahqo@saptco.com.sa','2025-Q4',  8, 6, 2, 5.0, 3.6, 3.8, 1, 'medium', 3.6,'brikaam@saptco.com.sa','[TEST] Some delays.'),
  ('abdullahqo@saptco.com.sa','2026-Q1', 11, 8, 3, 5.4, 3.4, 3.7, 2, 'high',   3.4,'brikaam@saptco.com.sa','[TEST] Watch the backlog.'),
  ('abdullahqo@saptco.com.sa','2026-Q2',  7, 4, 3, 5.8, 3.2, 3.6, 1, 'high',   3.2,'tss.bc2026@gmail.com','[TEST] Backlog growing.'),
  ('alsuhalirf@saptco.com.sa','2025-Q4',  6, 6, 0, 2.8, 4.8, 4.7, 0, 'low',    4.7,'brikaam@saptco.com.sa','[TEST] Excellent.'),
  ('alsuhalirf@saptco.com.sa','2026-Q1',  7, 6, 1, 3.0, 4.6, 4.5, 0, 'low',    4.5,'brikaam@saptco.com.sa','[TEST] Reliable.'),
  ('alsuhalirf@saptco.com.sa','2026-Q2',  5, 3, 1, 3.3, 4.4, 4.4, 0, 'medium', 4.3,'tss.bc2026@gmail.com','[TEST] On track.')
) as v(emp,period,assigned,completed,delayed,avgdays,freq,qual,returned,workload,score,evaluator,notes);

-- ── 8. Unread notifications batch (for meshari's bell + bulk actions) ───────
insert into public.notifications (user_id, type, title, message, is_read, created_at)
select (select id from _tu where email='aldosarimb@saptco.com.sa'), v.t::public.notification_type, v.title, v.msg, false, v.at::timestamptz
from (values
  ('task_assigned','[TEST] Task assigned',          'You were assigned a new task.',         '2026-06-10 09:00+03'),
  ('task_review_requested','[TEST] Review requested','A task you own needs review.',          '2026-06-11 10:00+03'),
  ('comment_added','[TEST] New comment',            'A new comment was added to your task.', '2026-06-12 11:00+03'),
  ('task_returned','[TEST] Task returned',          'A task was returned for modification.', '2026-06-12 15:00+03'),
  ('system','[TEST] System notice',                 'Scheduled maintenance this weekend.',   '2026-06-13 08:00+03'),
  ('task_completed','[TEST] Task completed',        'A task you follow was completed.',      '2026-06-13 16:00+03')
) as v(t,title,msg,at);

-- ── 9. Test weekly dashboard snapshot (raw_file_path='test-seed', always-live)
--     FULL 4-business-line / 38-KPI DASHBOARD_DATA (the weekly-dashboard-sample
--     payload, Zod-validated) so the CEO/weekly view shows the complete board
--     without the manual .xlsx upload. week_start is current so it stays latest
--     live; uploaded_by = real admin.
insert into public.dashboard_snapshots (week_start, data, uploaded_by, task_id, raw_file_path)
values (
  '2026-06-08',
  '{"meta":{"title":"Business Lines · Weekly Dashboard","subtitle":"Technical Shared Services · SAPTCO","lastRefreshed":"25 May 2026 · 09:00 AST","weekStart":"2026-05-19","periods":[{"id":"week","label":"This Week"},{"id":"mtd","label":"Month to Date"},{"id":"ytd","label":"Year to Date"}],"defaultBl":"tss","defaultPeriod":"week","footLeft":"TSS Weekly Dashboard · Week 21 · 19–25 May 2026","footRight":"Sourced from Revenue · Technician KPI · Fleet · Insurance · Closing & SDS reports · 17 source files"},"businessLines":[{"id":"tss","name":"TSS · Consolidated","accent":"#762651","isSample":false,"tagline":"Technical Shared Services · portfolio roll-up across all business lines","kpiGroups":[{"num":"01","title":"Consolidated Revenue","subtitle":"Across merapp · Driving School · Aalam Alreyadah","accent":"#762651","cols":4,"kpis":[{"id":"t-rev","label":"Total Revenue","lead":true,"tag":"GROUP","values":{"week":"SAR 543K","mtd":"SAR 1.68M","ytd":"SAR 7.32M"},"delta":{"dir":"up","text":"+9% vs prior week"},"rag":"green","note":"YTD across 3 active business lines"},{"id":"t-billed","label":"Billed Revenue","values":{"week":"SAR 421K","mtd":"SAR 1.29M","ytd":"SAR 5.71M"},"delta":{"dir":"up","text":"78% of contracted"},"rag":"green","note":"Invoiced & recognised"},{"id":"t-unbilled","label":"Unbilled / Backlog","values":{"week":"SAR 122K","mtd":"SAR 392K","ytd":"SAR 1.61M"},"delta":{"dir":"flat","text":"22% remaining"},"rag":"amber","note":"Mostly ARTC PO backlog"},{"id":"t-margin","label":"Avg Operating Margin","values":{"week":"31%","mtd":"30%","ytd":"29%"},"delta":{"dir":"up","text":"+2 pts vs Q1"},"rag":"green","note":"Blended across lines","target":{"value":29,"target":32,"suffix":"%"}}]},{"num":"02","title":"Portfolio Operations","subtitle":"Active lines · throughput · people","accent":"#193560","cols":4,"kpis":[{"id":"t-lines","label":"Active Business Lines","values":{"week":"3 / 4","mtd":"3 / 4","ytd":"3 / 4"},"delta":{"dir":"flat","text":"ARTC in preview"},"rag":"amber","note":"TSS corporate + 3 operating"},{"id":"t-cards","label":"Total Job Cards / Engagements","values":{"week":"186","mtd":"438","ytd":"4,180"},"delta":{"dir":"up","text":"merapp + DS + ARTC"},"rag":"green","note":"Cards, customers, cohorts"},{"id":"t-people","label":"Frontline Headcount","values":{"week":"83","mtd":"83","ytd":"83"},"delta":{"dir":"flat","text":"technicians + instructors"},"rag":"green","note":"Across all lines"},{"id":"t-util","label":"Blended Utilization","values":{"week":"0.81","mtd":"0.81","ytd":"0.80"},"delta":{"dir":"flat","text":"vs 0.90 target"},"rag":"amber","note":"Capacity-weighted","target":{"value":81,"target":90,"suffix":"%"}}]}],"charts":[{"id":"tss-trend","type":"line","title":"Consolidated Weekly Revenue Trend","subtitle":"Last 5 weeks · SAR · by business line","valueKind":"currency","span":"wide","categories":["W17","W18","W19","W20","W21"],"series":[{"name":"merapp","color":"#EE8742","data":[86000,91000,88000,95000,98000]},{"name":"Driving School","color":"#3D8540","data":[58000,61000,60000,63000,64620]},{"name":"Aalam Alreyadah","color":"#6AA5CD","data":[340000,355000,360000,372000,380000]}]},{"id":"tss-mix","type":"doughnut","title":"Revenue by Business Line","subtitle":"YTD share","valueKind":"currency","span":"half","segments":[{"label":"Aalam Alreyadah","value":4240000,"color":"#6AA5CD"},{"label":"merapp","value":1742724,"color":"#EE8742"},{"label":"Driving School","value":1340000,"color":"#3D8540"}]},{"id":"tss-billed","type":"groupedBar","title":"Billed vs Backlog","subtitle":"YTD · SAR · by business line","valueKind":"currency","span":"half","categories":["merapp","Driving School","Aalam Alreyadah"],"series":[{"name":"Billed","color":"#193560","data":[1742724,1340000,2630000]},{"name":"Backlog","color":"#B780A0","data":[0,0,1610000]}]}],"tables":[{"id":"tss-scorecard","title":"Business Line Scorecard","meta":"YTD · consolidated","columns":[{"key":"name","label":"Business Line","kind":"text","strong":true},{"key":"type","label":"Segment","kind":"chip"},{"key":"rev","label":"Revenue (SAR)","align":"right","kind":"currency","strong":true},{"key":"billed","label":"Billed (SAR)","align":"right","kind":"currency"},{"key":"units","label":"Volume","align":"right","kind":"num"},{"key":"share","label":"Share of group","kind":"share"},{"key":"status","label":"Status","kind":"rag"}],"rows":[{"name":"Aalam Alreyadah","type":{"label":"Training"},"rev":4240000,"billed":2630000,"units":"824 trainees","share":{"pct":57.9,"color":"#6AA5CD"},"status":{"label":"Sample","level":"amber"}},{"name":"merapp","type":{"label":"Aftermarket"},"rev":1742724,"billed":1742724,"units":"1,261 cards","share":{"pct":23.8,"color":"#EE8742"},"status":{"label":"On Track","level":"green"}},{"name":"Driving School","type":{"label":"Licensing"},"rev":1340000,"billed":1340000,"units":"1,840 custs","share":{"pct":18.3,"color":"#3D8540"},"status":{"label":"On Track","level":"green"}}]}]},{"id":"merapp","name":"merapp","accent":"#EE8742","isSample":false,"tagline":"Automotive maintenance & repair · 3 branches · 742 fleet vehicles","kpiGroups":[{"num":"01","title":"Revenue KPIs","subtitle":"Parts · Labor · Fleet · Insurance","accent":"#EE8742","cols":7,"kpis":[{"id":"rev-total","label":"Total Revenue","lead":true,"tag":"BL01","values":{"week":"SAR 98K","mtd":"SAR 312K","ytd":"SAR 1.74M"},"delta":{"dir":"up","text":"+12% vs prior week"},"rag":"green","note":"YTD SAR 1,742,724 · 60.5% corporate fleet"},{"id":"rev-parts","label":"Part Revenue","values":{"week":"SAR 54K","mtd":"SAR 168K","ytd":"SAR 946K"},"delta":{"dir":"up","text":"+8% vs prior week"},"rag":"green","note":"YTD SAR 946,858"},{"id":"rev-labor","label":"Labor Revenue","values":{"week":"SAR 32K","mtd":"SAR 102K","ytd":"SAR 567K"},"delta":{"dir":"up","text":"+6% vs prior week"},"rag":"green","note":"YTD SAR 566,554"},{"id":"rev-fleet","label":"Fleet Revenue","values":{"week":"SAR 60K","mtd":"SAR 190K","ytd":"SAR 1.05M"},"delta":{"dir":"up","text":"60.5% of revenue mix"},"rag":"green","note":"YTD SAR 1,054,676"},{"id":"rev-avgcard","label":"Avg Rev / Job Card","values":{"week":"SAR 1,584","mtd":"SAR 1,605","ytd":"SAR 1,616"},"delta":{"dir":"flat","text":"tracking near target"},"rag":"amber","note":"Target SAR 1,700 · −5%"},{"id":"rev-avgtech","label":"Avg Tech Revenue","values":{"week":"SAR 1,160","mtd":"SAR 3,830","ytd":"SAR 11,602"},"delta":{"dir":"flat","text":"Dammam scope"},"rag":"amber","note":"10 Dammam technicians"},{"id":"rev-ins","label":"Insurance Claims","values":{"week":"SAR 22K","mtd":"SAR 71K","ytd":"SAR 671K"},"delta":{"dir":"up","text":"132 claims YTD"},"rag":"green","note":"YTD SAR 671,037"}]},{"num":"02","title":"Operations KPIs","subtitle":"Throughput · Productivity · Technicians","accent":"#193560","cols":6,"kpis":[{"id":"ops-eff","label":"Efficiency","values":{"week":"90%","mtd":"90%","ytd":"90%"},"delta":{"dir":"up","text":"Dammam on target"},"rag":"green","note":"Dammam · ≥ 100% target","target":{"value":90,"target":100,"suffix":"%"}},{"id":"ops-techs","label":"Active Technicians","values":{"week":"29","mtd":"29","ytd":"29"},"delta":{"dir":"flat","text":"489 tasks logged"},"rag":"amber","note":"4 below capacity (33)"},{"id":"ops-open","label":"Open / Partial Cards","values":{"week":"38","mtd":"94","ytd":"~180"},"delta":{"dir":"down","text":"partial-paid backlog"},"rag":"red","note":"≈180 need follow-up"},{"id":"ops-util","label":"Avg Tech Utilization","values":{"week":"0.85","mtd":"0.85","ytd":"0.85"},"delta":{"dir":"flat","text":"avg of 10 techs"},"rag":"amber","note":"Dammam · capacity ratio","target":{"value":85,"target":100,"suffix":"%"}},{"id":"ops-hrs","label":"Avg Tech Actual Hrs","values":{"week":"34 h","mtd":"106 h","ytd":"106 h"},"delta":{"dir":"up","text":"per technician"},"rag":"green","note":"Dammam · 1,063 h logged"},{"id":"ops-prod","label":"Avg Tech Productivity","values":{"week":"0.71","mtd":"0.71","ytd":"0.71"},"delta":{"dir":"flat","text":"vs 0.90 target"},"rag":"amber","note":"Dammam · billable ratio"}]}],"charts":[{"id":"m-branch","type":"groupedBar","title":"Revenue by Branch","subtitle":"Parts vs Labor · YTD (SAR)","valueKind":"currency","span":"wide","categories":["Riyadh (Faisaliyah)","Dammam","Tabuk"],"series":[{"name":"Parts","color":"#EE8742","data":[710297,126556,92538]},{"name":"Labor","color":"#193560","data":[382791,102233,55748]}]},{"id":"m-segment","type":"doughnut","title":"Revenue by Segment","subtitle":"YTD share of revenue","valueKind":"currency","span":"half","segments":[{"label":"Corporate Fleet","value":1054676,"color":"#EE8742"},{"label":"Car Rental","value":408744,"color":"#193560"},{"label":"Walk-In","value":276322,"color":"#6AA5CD"},{"label":"Other","value":2982,"color":"#C2CAD7"}]},{"id":"m-insurers","type":"bar","title":"Insurance Claims by Provider","subtitle":"Count of claims · YTD","valueKind":"count","span":"half","segments":[{"label":"Najm","value":71,"color":"#193560"},{"label":"Med Gulf","value":41,"color":"#6AA5CD"},{"label":"360 Network","value":20,"color":"#9CB4CF"}]}],"tables":[{"id":"m-techs","title":"Technician KPIs","meta":"Dammam · top 10 by revenue","columns":[{"key":"name","label":"Technician","kind":"text","strong":true},{"key":"type","label":"Type","kind":"chip"},{"key":"eff","label":"Efficiency","kind":"minibar"},{"key":"prod","label":"Prod.","align":"right","kind":"num"},{"key":"util","label":"Util.","align":"right","kind":"num"},{"key":"hrs","label":"Hours","align":"right","kind":"num"},{"key":"rev","label":"Revenue (SAR)","align":"right","kind":"currency","strong":true},{"key":"status","label":"Status","kind":"rag"}],"rows":[{"name":"Mohammad Afsar","type":{"label":"Body Repair"},"eff":{"value":0.9,"max":1.4,"display":"0.90","color":"#2E7D33"},"prod":"1.10","util":"1.21","hrs":"142.6","rev":16247,"status":{"label":"On Target","level":"green"}},{"name":"Faizan Khan","type":{"label":"Mechanical"},"eff":{"value":1.13,"max":1.4,"display":"1.13","color":"#2E7D33"},"prod":"0.96","util":"0.85","hrs":"99.9","rev":15758,"status":{"label":"On Target","level":"green"}},{"name":"Mohammad Yakub","type":{"label":"Mechanical"},"eff":{"value":0.64,"max":1.4,"display":"0.64","color":"#C0303F"},"prod":"0.90","util":"1.40","hrs":"153.0","rev":14352,"status":{"label":"Below Target","level":"red"}},{"name":"Kamil Naseem Ahmad","type":{"label":"Body Repair"},"eff":{"value":0.87,"max":1.4,"display":"0.87","color":"#9A6B12"},"prod":"0.86","util":"0.99","hrs":"124.9","rev":14064,"status":{"label":"Near Target","level":"amber"}},{"name":"Waseem Mohammad","type":{"label":"Mechanical"},"eff":{"value":0.78,"max":1.4,"display":"0.78","color":"#9A6B12"},"prod":"0.81","util":"1.04","hrs":"133.0","rev":13675,"status":{"label":"Near Target","level":"amber"}},{"name":"Raja Ehisham Haider","type":{"label":"Electrical"},"eff":{"value":1.25,"max":1.4,"display":"1.25","color":"#2E7D33"},"prod":"0.47","util":"0.38","hrs":"47.8","rev":9268,"status":{"label":"On Target","level":"green"}},{"name":"Mohammed Faiz","type":{"label":"Body Repair"},"eff":{"value":0.67,"max":1.4,"display":"0.67","color":"#C0303F"},"prod":"0.78","util":"1.15","hrs":"135.0","rev":9144,"status":{"label":"Below Target","level":"red"}},{"name":"Mohammad Ismail","type":{"label":"Electrical"},"eff":{"value":1.06,"max":1.4,"display":"1.06","color":"#2E7D33"},"prod":"0.00","util":"0.00","hrs":"51.5","rev":9142,"status":{"label":"On Target","level":"green"}},{"name":"Gufran Khan","type":{"label":"Body Repair"},"eff":{"value":0.92,"max":1.4,"display":"0.92","color":"#9A6B12"},"prod":"0.68","util":"0.74","hrs":"79.7","rev":7466,"status":{"label":"Near Target","level":"amber"}},{"name":"Shahjan Khan","type":{"label":"Body Repair"},"eff":{"value":0.76,"max":1.4,"display":"0.76","color":"#C0303F"},"prod":"0.58","util":"0.76","hrs":"96.1","rev":6900,"status":{"label":"Below Target","level":"red"}}]},{"id":"m-branches","title":"Branch Performance","meta":"YTD · parts + labor","columns":[{"key":"name","label":"Branch","kind":"text","strong":true},{"key":"parts","label":"Parts (SAR)","align":"right","kind":"currency"},{"key":"labor","label":"Labor (SAR)","align":"right","kind":"currency"},{"key":"net","label":"Net (SAR)","align":"right","kind":"currency","strong":true},{"key":"cards","label":"Job Cards","align":"right","kind":"num"},{"key":"avg","label":"Avg / Card","align":"right","kind":"num"},{"key":"share","label":"Share of YTD","kind":"share"},{"key":"status","label":"Status","kind":"rag"}],"rows":[{"name":"Riyadh (Faisaliyah)","parts":710297,"labor":382791,"net":1257050,"cards":"895","avg":"SAR 1,405","share":{"pct":72.1,"color":"#EE8742"},"status":{"label":"Primary","level":"green"}},{"name":"Dammam","parts":126556,"labor":102233,"net":263107,"cards":"183","avg":"SAR 1,438","share":{"pct":15.1,"color":"#193560"},"status":{"label":"Active","level":"green"}},{"name":"Tabuk","parts":92538,"labor":55748,"net":170529,"cards":"—","avg":"—","share":{"pct":9.8,"color":"#6AA5CD"},"status":{"label":"Growing","level":"amber"}}]}]},{"id":"artc","name":"Aalam Alreyadah","accent":"#6AA5CD","isSample":true,"tagline":"Leadership & training academy · illustrative preview","kpiGroups":[{"num":"01","title":"Revenue KPIs","subtitle":"Purchase orders · per-trainee · per-day","accent":"#6AA5CD","cols":5,"kpis":[{"id":"a-po","label":"Total PO Value","lead":true,"tag":"SAMPLE","values":{"week":"SAR 0.38M","mtd":"SAR 1.16M","ytd":"SAR 4.24M"},"delta":{"dir":"up","text":"contracted"},"rag":"green","note":"Illustrative · 14 customers"},{"id":"a-billed","label":"Billed PO Value","values":{"week":"SAR 0.24M","mtd":"SAR 0.72M","ytd":"SAR 2.63M"},"delta":{"dir":"up","text":"62% of PO value"},"rag":"green","note":"Illustrative · invoiced"},{"id":"a-unbilled","label":"Unbilled PO Value","values":{"week":"SAR 0.14M","mtd":"SAR 0.44M","ytd":"SAR 1.61M"},"delta":{"dir":"flat","text":"38% remaining"},"rag":"amber","note":"Illustrative · backlog"},{"id":"a-pertrainee","label":"Revenue / Trainee","values":{"week":"SAR 2,980","mtd":"SAR 3,060","ytd":"SAR 3,150"},"delta":{"dir":"up","text":"blended"},"rag":"green","note":"Illustrative · 824 trainees"},{"id":"a-perday","label":"Revenue / Training Day","values":{"week":"SAR 17,200","mtd":"SAR 17,850","ytd":"SAR 18,400"},"delta":{"dir":"up","text":"avg billing / day"},"rag":"green","note":"Illustrative · 230 days"}]},{"num":"02","title":"Operations KPIs","subtitle":"Pipeline · customers · trainees · courses","accent":"#193560","cols":4,"kpis":[{"id":"a-cust","label":"Active Customers","values":{"week":"11","mtd":"13","ytd":"14"},"delta":{"dir":"up","text":"+3 vs last qtr"},"rag":"green","note":"Illustrative · corp & gov"},{"id":"a-pipe","label":"Pipeline Value","values":{"week":"SAR 6.20M","mtd":"SAR 6.50M","ytd":"SAR 6.80M"},"delta":{"dir":"up","text":"weighted"},"rag":"green","note":"Illustrative · 22 open deals"},{"id":"a-trainees","label":"Number of Trainees","values":{"week":"36","mtd":"118","ytd":"824"},"delta":{"dir":"up","text":"enrolled"},"rag":"green","note":"Illustrative · 47 cohorts"},{"id":"a-courses","label":"Courses Delivered","values":{"week":"2","mtd":"7","ytd":"47"},"delta":{"dir":"up","text":"completed"},"rag":"green","note":"Illustrative · leadership track"}]}],"charts":[{"id":"a-billing","type":"doughnut","title":"PO Value · Billed vs Unbilled","subtitle":"YTD share","valueKind":"currency","span":"half","segments":[{"label":"Billed","value":2630000,"color":"#6AA5CD"},{"label":"Unbilled","value":1610000,"color":"#193560"}]}],"tables":[]},{"id":"driving-school","name":"SAPTCO Driving School","accent":"#3D8540","isSample":false,"tagline":"Driver training · Riyadh · May 2026 (cumulative May 4–18)","kpiGroups":[{"num":"01","title":"Revenue KPIs","subtitle":"Revenue · per-customer · by category","accent":"#3D8540","cols":4,"kpis":[{"id":"d-total","label":"Total Revenue","lead":true,"tag":"DS01","values":{"week":"SAR 64,620","mtd":"SAR 129,246","ytd":"SAR 1.34M"},"delta":{"dir":"up","text":"Private + Heavy Transport"},"rag":"green","note":"MTD exact: SAR 129,245.50"},{"id":"d-percust","label":"Avg Revenue / Customer","values":{"week":"SAR 745","mtd":"SAR 751","ytd":"SAR 728"},"delta":{"dir":"flat","text":"blended"},"rag":"green","note":"Total ÷ customers"},{"id":"d-private","label":"Private Revenue","values":{"week":"SAR 47,438","mtd":"SAR 94,875","ytd":"SAR 984K"},"delta":{"dir":"up","text":"73% of revenue"},"rag":"green","note":"Beginner · Inter · Advanced"},{"id":"d-heavy","label":"Heavy Transport Revenue","values":{"week":"SAR 17,185","mtd":"SAR 34,371","ytd":"SAR 356K"},"delta":{"dir":"up","text":"27% of revenue"},"rag":"green","note":"Skilled · Non-skilled"}]},{"num":"02","title":"Operations KPIs","subtitle":"Customers · capacity · activity","accent":"#193560","cols":4,"kpis":[{"id":"d-cust","label":"Number of Customers","values":{"week":"86","mtd":"172","ytd":"1,840"},"delta":{"dir":"up","text":"across categories"},"rag":"green","note":"Private 115 · Heavy 57"},{"id":"d-slots","label":"Absher Slots Available","values":{"week":"2,430","mtd":"2,430","ytd":"2,430"},"delta":{"dir":"flat","text":"bookable capacity"},"rag":"green","note":"Private 2,060 · Heavy 370"},{"id":"d-addhrs","label":"Additional Hours","values":{"week":"21","mtd":"40","ytd":"470"},"delta":{"dir":"flat","text":"fail / absence"},"rag":"amber","note":"Private 39 · Heavy 1"},{"id":"d-cats","label":"Active Categories","values":{"week":"2 / 3","mtd":"2 / 3","ytd":"2 / 3"},"delta":{"dir":"flat","text":"Private · Heavy Transport"},"rag":"green","note":"Motorcycles: no activity"}]}],"charts":[{"id":"d-cat","type":"doughnut","title":"Revenue by Category","subtitle":"MTD share","valueKind":"currency","span":"half","segments":[{"label":"Private","value":94875,"color":"#3D8540"},{"label":"Heavy Transport","value":34371,"color":"#193560"}]}],"tables":[]}]}'::jsonb,
  (select id from _tu where email='tss.bc2026@gmail.com'),
  null,
  'test-seed'
);

-- ── Verification (full-period spread + per-feature presence + users untouched)
select '== tasks per month (expect every month Jan→Jun) ==' as section;
select to_char(date_trunc('month', created_at), 'YYYY-MM') as month, count(*) as tasks
from public.tasks where title like '[TEST]%' group by 1 order by 1;

select '== distinct statuses (expect 12) · overdue (active, due<today) ==' as section;
select (select count(distinct status) from public.tasks where title like '[TEST]%') as distinct_statuses,
       (select count(*) from public.tasks where title like '[TEST]%' and due_date < current_date
          and status not in ('completed','cancelled','rejected')) as overdue;

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
