-- Migration 14: reference_data_seed
-- Versioned, idempotent reference data so it ships to every environment via
-- `supabase db push` (db push does NOT run seed.sql). Without the permission
-- catalogue + role_permissions, even an admin is locked out — this guarantees
-- production has them. Mirrors supabase/seed.sql; all inserts are
-- ON CONFLICT DO NOTHING. No user/account rows (first admin is promoted by SQL).

-- ── Business lines (sort_order 1–7) ───────────────────────────────────────
insert into public.business_lines (name, sort_order) values
  ('TSS', 1),
  ('Meraap', 2),
  ('ARTC', 3),
  ('Driving School', 4),
  ('Dealership', 5),
  ('Corporate', 6),
  ('General', 7)
on conflict (name) do nothing;

-- ── Departments ───────────────────────────────────────────────────────────
insert into public.departments (name, is_active) values
  ('Business Consulting', true)
on conflict (name) do nothing;

-- ── App settings ──────────────────────────────────────────────────────────
insert into public.app_settings (key, value, description) values
  ('due_soon_threshold', '3', 'Days before due_date a task is flagged as due soon'),
  ('no_update_threshold', '2', 'Days without a task update before flagging stale')
on conflict (key) do nothing;

-- ── Permissions catalogue ─────────────────────────────────────────────────
insert into public.permissions (key, description, category) values
  ('tasks.create',          'Create tasks',                       'tasks'),
  ('tasks.read',            'Read own/assigned tasks',            'tasks'),
  ('tasks.read_all',        'Read all tasks',                     'tasks'),
  ('tasks.update',          'Update tasks',                       'tasks'),
  ('tasks.delete',          'Delete tasks',                       'tasks'),
  ('tasks.approve',         'Approve a pending task',             'tasks'),
  ('tasks.reject',          'Reject a pending task',              'tasks'),
  ('tasks.return',          'Return a task for modification',     'tasks'),
  ('tasks.assign',          'Assign a task to an employee',       'tasks'),
  ('tasks.submit_review',   'Submit a task for review',           'tasks'),
  ('tasks.close',           'Close/complete a task',              'tasks'),
  ('tasks.cancel',          'Cancel a task',                      'tasks'),
  ('tasks.reopen',          'Reopen a task',                      'tasks'),
  ('task_updates.create',   'Add a task progress update',         'task_updates'),
  ('task_updates.read',     'Read task progress updates',         'task_updates'),
  ('task_comments.create',  'Add a task comment',                 'comments'),
  ('task_comments.read',    'Read task comments',                 'comments'),
  ('task_comments.address', 'Mark a comment as addressed',        'comments'),
  ('attachments.upload',    'Upload task attachments',            'attachments'),
  ('attachments.download',  'Download task attachments',          'attachments'),
  ('workload.read',         'Read own workload',                  'workload'),
  ('workload.read_all',     'Read all workloads',                 'workload'),
  ('performance.read',      'Read own performance evaluations',   'performance'),
  ('performance.read_all',  'Read all performance evaluations',   'performance'),
  ('performance.evaluate',  'Create/update performance evaluations', 'performance'),
  ('recurring.manage',      'Manage recurring task templates',    'recurring'),
  ('reports.read',          'Read own reports',                   'reports'),
  ('reports.read_all',      'Read all reports',                   'reports'),
  ('notifications.read',    'Read own notifications',             'notifications'),
  ('settings.read',         'Read application settings',          'settings'),
  ('settings.manage',       'Manage application settings & reference data', 'settings'),
  ('users.read',            'Read user profiles',                 'users'),
  ('users.manage',          'Manage user profiles',               'users'),
  ('users.invite',          'Invite new users',                   'users'),
  ('roles.manage',          'Manage roles and role-permission mappings', 'roles'),
  ('audit.read',            'Read audit logs',                    'audit'),
  ('dashboard.view',        'View standard dashboard',            'dashboard'),
  ('dashboard.executive',   'View executive dashboard',           'dashboard')
on conflict (key) do nothing;

-- ── Role → permission mappings (by key) ───────────────────────────────────

-- employee
insert into public.role_permissions (role, permission_id)
select 'employee', id from public.permissions where key in (
  'tasks.create', 'tasks.read', 'tasks.update', 'tasks.submit_review',
  'task_updates.create', 'task_updates.read',
  'task_comments.create', 'task_comments.read',
  'attachments.upload', 'attachments.download',
  'workload.read', 'performance.read', 'reports.read',
  'notifications.read', 'dashboard.view'
)
on conflict do nothing;

-- section_head (all employee permissions plus management permissions)
insert into public.role_permissions (role, permission_id)
select 'section_head', id from public.permissions where key in (
  'tasks.create', 'tasks.read', 'tasks.update', 'tasks.submit_review',
  'task_updates.create', 'task_updates.read',
  'task_comments.create', 'task_comments.read',
  'attachments.upload', 'attachments.download',
  'workload.read', 'performance.read', 'reports.read',
  'notifications.read', 'dashboard.view',
  'tasks.read_all', 'tasks.approve', 'tasks.reject', 'tasks.return',
  'tasks.assign', 'tasks.close', 'tasks.cancel', 'tasks.reopen',
  'task_comments.address', 'workload.read_all', 'performance.read_all',
  'performance.evaluate', 'recurring.manage', 'reports.read_all',
  'settings.read', 'settings.manage', 'users.read', 'users.manage',
  'users.invite', 'audit.read'
)
on conflict do nothing;

-- ceo (read/oversight + commenting; no task authoring)
insert into public.role_permissions (role, permission_id)
select 'ceo', id from public.permissions where key in (
  'dashboard.view', 'dashboard.executive', 'tasks.read_all', 'reports.read_all',
  'workload.read_all', 'performance.read_all', 'task_comments.create',
  'task_comments.read', 'attachments.download', 'notifications.read'
)
on conflict do nothing;

-- admin (ALL permissions)
insert into public.role_permissions (role, permission_id)
select 'admin', id from public.permissions
on conflict do nothing;
