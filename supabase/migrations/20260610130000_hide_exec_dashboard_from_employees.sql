-- Hide the executive / Business-Lines (weekly) dashboard from employees.
--
-- Employees keep their PersonalDashboard (gated by dashboard.view, untouched).
-- The executive Business-Lines weekly surface is gated by dashboard.read, which
-- employees currently hold; this migration revokes ONLY that grant from the
-- employee role. admin / section_head / ceo are unchanged.
--
-- After the revoke:
--   • /dashboard          → employee falls back to PersonalDashboard; the
--                           Business-Lines selector tabs (canReadWeekly) hide.
--   • /dashboard/weekly    → WeeklyDashboardView renders a graceful
--                           "Access restricted" EmptyState (no crash, no
--                           /unauthorized redirect).
--
-- Idempotent. New migration — does not edit any deployed migration.

-- 1. Revoke dashboard.read from the employee role -----------------------------
delete from public.role_permissions rp
using public.permissions p
where rp.permission_id = p.id
  and rp.role = 'employee'
  and p.key = 'dashboard.read';

-- 2. Keep the weekly-upload flow working for the employee assignee ------------
-- The dashboard_snapshots TABLE insert policy already lets the linked task's
-- assignee insert independently of dashboard.read. The dashboard-uploads STORAGE
-- policy did NOT — it gated on (dashboard.upload OR dashboard.read) with no
-- assignee branch — so revoking dashboard.read would otherwise break an employee
-- assignee's raw-workbook upload (uploadWeeklyDashboard stores the file with the
-- caller's JWT before inserting the snapshot row).
--
-- Re-create dashboard_uploads_insert with an added assignee branch: a user who is
-- the assignee of a "Dashboard Update" task (the sentinel category that surfaces
-- the upload control, mirrored from src/lib/dashboard/constants.ts) may write to
-- the private dashboard-uploads bucket — independent of dashboard.read.
--
-- Wrapped in the same ownership guard the original used: on hosted Supabase the
-- migration role may not own storage.objects, in which case this is skipped and
-- the platform defaults + app-layer signed URLs apply.
do $do$
begin
  execute 'alter table storage.objects enable row level security';

  execute 'drop policy if exists dashboard_uploads_insert on storage.objects';
  execute $p$
    create policy dashboard_uploads_insert on storage.objects
      for insert to authenticated
      with check (
        bucket_id = 'dashboard-uploads'
        and (
          public.authorize('dashboard.upload')
          or public.authorize('dashboard.read')
          or exists (
            select 1
            from public.tasks t
            where t.assignee_id = auth.uid()
              and t.category = 'Dashboard Update'
          )
        )
      )
  $p$;
exception
  when insufficient_privilege then
    raise notice 'Skipping dashboard_uploads_insert rewrite: migration role lacks ownership of storage.objects (platform defaults + app-layer signed URLs apply).';
end
$do$;
