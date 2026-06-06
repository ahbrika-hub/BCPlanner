-- Migration 9: rls_policies
-- Enables Row Level Security on every table and defines explicit policies.
-- Default-deny: a user with no matching policy gets no access. Permission gates
-- use public.authorize(). Idempotent: policies are dropped before (re)creation.

-- ── Enable RLS on all tables ──────────────────────────────────────────────
alter table public.profiles                enable row level security;
alter table public.departments             enable row level security;
alter table public.permissions             enable row level security;
alter table public.role_permissions        enable row level security;
alter table public.business_lines          enable row level security;
alter table public.app_settings            enable row level security;
alter table public.tasks                   enable row level security;
alter table public.task_updates            enable row level security;
alter table public.task_comments           enable row level security;
alter table public.task_attachments        enable row level security;
alter table public.recurring_tasks         enable row level security;
alter table public.performance_evaluations enable row level security;
alter table public.notifications           enable row level security;
alter table public.audit_logs              enable row level security;
alter table public.task_no_counters        enable row level security;

-- ── profiles ──────────────────────────────────────────────────────────────
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (auth.uid() = id or public.authorize('users.read'));

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update to authenticated
  using (auth.uid() = id or public.authorize('users.manage'))
  with check (auth.uid() = id or public.authorize('users.manage'));
-- INSERT handled by handle_new_user() trigger; DELETE admin-only via service role.

-- ── departments ───────────────────────────────────────────────────────────
drop policy if exists departments_select on public.departments;
create policy departments_select on public.departments
  for select to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and is_active = true));

drop policy if exists departments_write on public.departments;
create policy departments_write on public.departments
  for all to authenticated
  using (public.authorize('users.manage'))
  with check (public.authorize('users.manage'));

-- ── permissions ───────────────────────────────────────────────────────────
drop policy if exists permissions_select on public.permissions;
create policy permissions_select on public.permissions
  for select to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and is_active = true));

drop policy if exists permissions_write on public.permissions;
create policy permissions_write on public.permissions
  for all to authenticated
  using (public.authorize('roles.manage'))
  with check (public.authorize('roles.manage'));

-- ── role_permissions ──────────────────────────────────────────────────────
drop policy if exists role_permissions_select on public.role_permissions;
create policy role_permissions_select on public.role_permissions
  for select to authenticated
  using (public.authorize('roles.manage'));

drop policy if exists role_permissions_write on public.role_permissions;
create policy role_permissions_write on public.role_permissions
  for all to authenticated
  using (public.authorize('roles.manage'))
  with check (public.authorize('roles.manage'));

-- ── business_lines ────────────────────────────────────────────────────────
drop policy if exists business_lines_select on public.business_lines;
create policy business_lines_select on public.business_lines
  for select to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and is_active = true));

drop policy if exists business_lines_write on public.business_lines;
create policy business_lines_write on public.business_lines
  for all to authenticated
  using (public.authorize('settings.manage'))
  with check (public.authorize('settings.manage'));

-- ── app_settings ──────────────────────────────────────────────────────────
drop policy if exists app_settings_select on public.app_settings;
create policy app_settings_select on public.app_settings
  for select to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and is_active = true));

drop policy if exists app_settings_write on public.app_settings;
create policy app_settings_write on public.app_settings
  for all to authenticated
  using (public.authorize('settings.manage'))
  with check (public.authorize('settings.manage'));

-- ── task_no_counters ──────────────────────────────────────────────────────
-- No client policies. Only generate_task_no() (SECURITY DEFINER) writes here.

-- ── tasks ─────────────────────────────────────────────────────────────────
drop policy if exists tasks_select on public.tasks;
create policy tasks_select on public.tasks
  for select to authenticated
  using (
    auth.uid() = created_by
    or auth.uid() = assignee_id
    or public.authorize('tasks.read_all')
  );

drop policy if exists tasks_insert on public.tasks;
create policy tasks_insert on public.tasks
  for insert to authenticated
  with check (public.authorize('tasks.create') and auth.uid() = created_by);

drop policy if exists tasks_update on public.tasks;
create policy tasks_update on public.tasks
  for update to authenticated
  using (
    ((auth.uid() = created_by or auth.uid() = assignee_id) and public.authorize('tasks.update'))
    or (public.authorize('tasks.read_all') and public.authorize('tasks.update'))
  )
  with check (
    ((auth.uid() = created_by or auth.uid() = assignee_id) and public.authorize('tasks.update'))
    or (public.authorize('tasks.read_all') and public.authorize('tasks.update'))
  );

drop policy if exists tasks_delete on public.tasks;
create policy tasks_delete on public.tasks
  for delete to authenticated
  using (public.authorize('tasks.delete'));

-- ── task_updates (immutable from clients) ─────────────────────────────────
drop policy if exists task_updates_select on public.task_updates;
create policy task_updates_select on public.task_updates
  for select to authenticated
  using (
    exists (
      select 1 from public.tasks t
      where t.id = task_id
        and (t.created_by = auth.uid() or t.assignee_id = auth.uid() or public.authorize('tasks.read_all'))
    )
  );

drop policy if exists task_updates_insert on public.task_updates;
create policy task_updates_insert on public.task_updates
  for insert to authenticated
  with check (
    public.authorize('task_updates.create')
    and (
      exists (select 1 from public.tasks where id = task_id and assignee_id = auth.uid())
      or public.authorize('tasks.read_all')
    )
  );
-- No UPDATE/DELETE policy: rows are immutable from the client.

-- ── task_comments ─────────────────────────────────────────────────────────
drop policy if exists task_comments_select on public.task_comments;
create policy task_comments_select on public.task_comments
  for select to authenticated
  using (
    exists (
      select 1 from public.tasks t
      where t.id = task_id
        and (t.created_by = auth.uid() or t.assignee_id = auth.uid() or public.authorize('tasks.read_all'))
    )
  );

drop policy if exists task_comments_insert on public.task_comments;
create policy task_comments_insert on public.task_comments
  for insert to authenticated
  with check (
    public.authorize('task_comments.create')
    and author_id = auth.uid()
    and exists (
      select 1 from public.tasks t
      where t.id = task_id
        and (t.created_by = auth.uid() or t.assignee_id = auth.uid() or public.authorize('tasks.read_all'))
    )
  );

drop policy if exists task_comments_update on public.task_comments;
create policy task_comments_update on public.task_comments
  for update to authenticated
  using (public.authorize('task_comments.address'))
  with check (public.authorize('task_comments.address'));

-- ── task_attachments ──────────────────────────────────────────────────────
drop policy if exists task_attachments_select on public.task_attachments;
create policy task_attachments_select on public.task_attachments
  for select to authenticated
  using (
    public.authorize('attachments.download')
    and exists (
      select 1 from public.tasks t
      where t.id = task_id
        and (t.created_by = auth.uid() or t.assignee_id = auth.uid() or public.authorize('tasks.read_all'))
    )
  );

drop policy if exists task_attachments_insert on public.task_attachments;
create policy task_attachments_insert on public.task_attachments
  for insert to authenticated
  with check (
    public.authorize('attachments.upload')
    and uploaded_by = auth.uid()
    and exists (
      select 1 from public.tasks t
      where t.id = task_id
        and (t.created_by = auth.uid() or t.assignee_id = auth.uid() or public.authorize('tasks.read_all'))
    )
  );

drop policy if exists task_attachments_delete on public.task_attachments;
create policy task_attachments_delete on public.task_attachments
  for delete to authenticated
  using (uploaded_by = auth.uid() or public.authorize('tasks.delete'));

-- ── recurring_tasks ───────────────────────────────────────────────────────
drop policy if exists recurring_tasks_select on public.recurring_tasks;
create policy recurring_tasks_select on public.recurring_tasks
  for select to authenticated
  using (public.authorize('recurring.manage'));

drop policy if exists recurring_tasks_write on public.recurring_tasks;
create policy recurring_tasks_write on public.recurring_tasks
  for all to authenticated
  using (public.authorize('recurring.manage'))
  with check (public.authorize('recurring.manage'));

-- ── performance_evaluations ───────────────────────────────────────────────
drop policy if exists performance_evaluations_select on public.performance_evaluations;
create policy performance_evaluations_select on public.performance_evaluations
  for select to authenticated
  using (employee_id = auth.uid() or public.authorize('performance.read_all'));

drop policy if exists performance_evaluations_insert on public.performance_evaluations;
create policy performance_evaluations_insert on public.performance_evaluations
  for insert to authenticated
  with check (public.authorize('performance.evaluate'));

drop policy if exists performance_evaluations_update on public.performance_evaluations;
create policy performance_evaluations_update on public.performance_evaluations
  for update to authenticated
  using (public.authorize('performance.evaluate'))
  with check (public.authorize('performance.evaluate'));

drop policy if exists performance_evaluations_delete on public.performance_evaluations;
create policy performance_evaluations_delete on public.performance_evaluations
  for delete to authenticated
  using (public.authorize('performance.evaluate') and public.authorize('users.manage'));

-- ── notifications ─────────────────────────────────────────────────────────
drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists notifications_update on public.notifications;
create policy notifications_update on public.notifications
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
-- No INSERT (service-role/triggers only). No DELETE.

-- ── audit_logs ────────────────────────────────────────────────────────────
drop policy if exists audit_logs_select on public.audit_logs;
create policy audit_logs_select on public.audit_logs
  for select to authenticated
  using (public.authorize('audit.read'));
-- No INSERT/UPDATE/DELETE from clients ever (service role / triggers only).
