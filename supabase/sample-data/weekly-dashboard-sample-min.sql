-- Compact single-snapshot sample data for the Business Lines dashboard.
-- One current-week snapshot (2026-06-09); lines: merapp, artc, driving-school.
-- Paste into the Supabase SQL editor. Safe to re-run (replaces the sample row).
-- Remove with: delete from public.dashboard_snapshots where raw_file_path = 'sample-seed';
begin;
delete from public.dashboard_snapshots where raw_file_path = 'sample-seed';
insert into public.dashboard_snapshots (week_start, data, uploaded_by, task_id, raw_file_path)
values (
  '2026-06-09',
  '{"meta":{"title":"Weekly Business Lines Dashboard","subtitle":"Week of 2026-06-09 · sample data","lastRefreshed":"2026-06-09","weekStart":"2026-06-09","periods":[{"id":"week","label":"Week"},{"id":"mtd","label":"MTD"},{"id":"ytd","label":"YTD"}],"defaultBl":"merapp","defaultPeriod":"week","footLeft":"Sample data — generated for preview","footRight":"Generated 2026-06-09"},"businessLines":[{"id":"merapp","name":"Merapp","accent":"#762651","isSample":true,"kpiGroups":[{"num":1,"title":"Summary","kpis":[{"id":"merapp-revenue","label":"Revenue","values":{"week":"SAR 1.2M","mtd":"SAR 4.8M","ytd":"SAR 52M"},"delta":"","rag":"green"},{"id":"merapp-on-time","label":"On-time Delivery","values":{"week":"94%","mtd":"95%","ytd":"93%"},"delta":"","rag":"amber"}]}],"charts":[],"tables":[]},{"id":"artc","name":"ARTC","accent":"#193560","isSample":true,"kpiGroups":[{"num":1,"title":"Summary","kpis":[{"id":"artc-revenue","label":"Revenue","values":{"week":"SAR 0.6M","mtd":"SAR 2.4M","ytd":"SAR 27M"},"delta":"","rag":"green"},{"id":"artc-on-time","label":"On-time Delivery","values":{"week":"88%","mtd":"90%","ytd":"89%"},"delta":"","rag":"amber"}]}],"charts":[],"tables":[]},{"id":"driving-school","name":"SDS","accent":"#0E7490","isSample":true,"kpiGroups":[{"num":1,"title":"Summary","kpis":[{"id":"driving-school-revenue","label":"Revenue","values":{"week":"SAR 0.4M","mtd":"SAR 1.6M","ytd":"SAR 18M"},"delta":"","rag":"green"},{"id":"driving-school-on-time","label":"On-time Delivery","values":{"week":"96%","mtd":"95%","ytd":"96%"},"delta":"","rag":"amber"}]}],"charts":[],"tables":[]}]}'::jsonb,
  (select id from public.profiles where role = 'admin' limit 1),
  null,
  'sample-seed'
);
commit;
