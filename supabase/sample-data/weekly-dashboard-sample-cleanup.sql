-- Remove the weekly dashboard SAMPLE data inserted by
-- supabase/sample-data/weekly-dashboard-sample.sql. Affects ONLY sentinel rows.
delete from public.dashboard_snapshots where raw_file_path = 'sample-seed';
