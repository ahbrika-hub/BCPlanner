-- Migration 10: task_system_support
-- Server-callable notification factory, attachments storage bucket + policies,
-- and a status-change audit trigger. Idempotent.

-- ── A1: create_notification (SECURITY DEFINER) ────────────────────────────
-- notifications has no client INSERT policy; server actions create rows for
-- *other* users through this function via supabase.rpc('create_notification').
create or replace function public.create_notification(
  p_user_id uuid,
  p_type public.notification_type,
  p_title text,
  p_message text,
  p_task_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id uuid;
begin
  insert into public.notifications (user_id, type, title, message, task_id)
  values (p_user_id, p_type, p_title, p_message, p_task_id)
  returning id into new_id;
  return new_id;
end;
$$;

revoke all on function public.create_notification(uuid, public.notification_type, text, text, uuid) from public;
grant execute on function public.create_notification(uuid, public.notification_type, text, text, uuid)
  to authenticated, service_role;

-- ── A2: attachments storage bucket ────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('task-attachments', 'task-attachments', false)
on conflict (id) do nothing;

-- ── A3: storage.objects RLS for the task-attachments bucket ───────────────
-- Coarse permission gates here; per-task visibility is enforced at the app
-- layer (downloads use server-generated signed URLs after an RLS-checked read).
alter table storage.objects enable row level security;

drop policy if exists task_attachments_insert on storage.objects;
create policy task_attachments_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'task-attachments' and public.authorize('attachments.upload'));

drop policy if exists task_attachments_select on storage.objects;
create policy task_attachments_select on storage.objects
  for select to authenticated
  using (bucket_id = 'task-attachments' and public.authorize('attachments.download'));

drop policy if exists task_attachments_delete on storage.objects;
create policy task_attachments_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'task-attachments'
    and (owner = auth.uid() or public.authorize('tasks.delete'))
  );

-- ── A4: audit trigger on task status changes (SECURITY DEFINER) ───────────
-- audit_logs has no client write policy; this definer function bypasses RLS.
create or replace function public.log_task_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, before_data, after_data)
  values (
    auth.uid(),
    'task.status_changed',
    'task',
    new.id,
    jsonb_build_object('status', old.status),
    jsonb_build_object('status', new.status)
  );
  return new;
end;
$$;

drop trigger if exists audit_task_status_change on public.tasks;
create trigger audit_task_status_change
  after update of status on public.tasks
  for each row
  when (old.status is distinct from new.status)
  execute function public.log_task_status_change();
