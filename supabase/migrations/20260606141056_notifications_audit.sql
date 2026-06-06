-- Migration 7: notifications_audit
-- User notifications and the immutable audit log.
-- Idempotent.

-- ── notifications ─────────────────────────────────────────────────────────
create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  task_id    uuid references public.tasks(id) on delete cascade,
  type       public.notification_type not null,
  title      text not null,
  message    text,
  is_read    boolean not null default false,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_user_read on public.notifications (user_id, is_read);
create index if not exists idx_notifications_task_id on public.notifications (task_id);

-- ── audit_logs (IMMUTABLE) ────────────────────────────────────────────────
create table if not exists public.audit_logs (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references public.profiles(id) on delete set null,
  action      text not null,
  entity_type text not null,
  entity_id   uuid,
  before_data jsonb,
  after_data  jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists idx_audit_logs_entity on public.audit_logs (entity_type, entity_id);
create index if not exists idx_audit_logs_actor_id on public.audit_logs (actor_id);
create index if not exists idx_audit_logs_created_at on public.audit_logs (created_at desc);

-- RLS applied in Part B of this phase. Do not expose DB publicly until Part B is complete.
