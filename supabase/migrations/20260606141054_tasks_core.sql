-- Migration 5: tasks_core
-- Tasks plus immutable updates, comments, attachments, the per-year task_no
-- counter, the task_no generator, and the status-transition guard.
--
-- The transition guard encodes the lifecycle state machine (see Step 1 / the
-- transition matrix in docs/DATABASE.md). It validates legal status changes and
-- stamps side-effect columns. Actor/role enforcement lives in RLS + the app
-- layer; this guard enforces the state machine and column stamping only.
-- Idempotent.

-- ── Per-year atomic task number counter ───────────────────────────────────
create table if not exists public.task_no_counters (
  year          integer primary key,
  current_value integer not null default 0
);

-- ── tasks ─────────────────────────────────────────────────────────────────
create table if not exists public.tasks (
  id                    uuid primary key default gen_random_uuid(),
  task_no               text unique,
  title                 text not null,
  description           text,
  category              text,
  business_line_id      uuid references public.business_lines(id) on delete set null,
  assignee_id           uuid references public.profiles(id) on delete set null,
  created_by            uuid not null references public.profiles(id),
  approved_by           uuid references public.profiles(id) on delete set null,
  priority              public.task_priority not null default 'medium',
  status                public.task_status not null default 'draft',
  progress_percentage   integer not null default 0 check (progress_percentage between 0 and 100),
  start_date            date,
  due_date              date,
  estimated_effort_hours numeric(6, 2),
  actual_effort_hours   numeric(6, 2),
  latest_action         text,
  next_action           text,
  challenges_blockers   text,
  required_support      text,
  closure_summary       text,
  quality_rating        integer check (quality_rating between 1 and 5),
  completed_at          timestamptz,
  cancelled_at          timestamptz,
  reopened_at           timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists idx_tasks_assignee_id on public.tasks (assignee_id);
create index if not exists idx_tasks_created_by on public.tasks (created_by);
create index if not exists idx_tasks_status on public.tasks (status);
create index if not exists idx_tasks_due_date on public.tasks (due_date);
create index if not exists idx_tasks_business_line_id on public.tasks (business_line_id);
create index if not exists idx_tasks_priority on public.tasks (priority);

drop trigger if exists set_tasks_updated_at on public.tasks;
create trigger set_tasks_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

-- ── task_no generator: TSS-BC-YYYY-NNNN (per-year atomic counter) ──────────
create or replace function public.generate_task_no()
returns trigger
language plpgsql
as $$
declare
  current_year integer := extract(year from now())::integer;
  next_val     integer;
begin
  insert into public.task_no_counters (year, current_value)
  values (current_year, 1)
  on conflict (year)
    do update set current_value = public.task_no_counters.current_value + 1
  returning current_value into next_val;

  new.task_no := 'TSS-BC-' || current_year::text || '-' || lpad(next_val::text, 4, '0');
  return new;
end;
$$;

drop trigger if exists set_task_no on public.tasks;
create trigger set_task_no
  before insert on public.tasks
  for each row
  when (new.task_no is null or new.task_no = '')
  execute function public.generate_task_no();

-- ── Status-transition guard ───────────────────────────────────────────────
create or replace function public.validate_task_transition()
returns trigger
language plpgsql
as $$
declare
  transition text;
  allowed    text[] := array[
    -- from draft
    'draft->pending_approval', 'draft->assigned', 'draft->cancelled',
    -- from pending_approval
    'pending_approval->approved', 'pending_approval->rejected', 'pending_approval->cancelled',
    -- from approved
    'approved->assigned', 'approved->in_progress', 'approved->pending_review', 'approved->cancelled',
    -- from assigned
    'assigned->in_progress', 'assigned->pending_review', 'assigned->cancelled',
    -- from in_progress
    'in_progress->pending_review', 'in_progress->pending_update', 'in_progress->cancelled',
    -- from pending_update
    'pending_update->in_progress', 'pending_update->pending_review', 'pending_update->cancelled',
    -- from pending_review
    'pending_review->completed', 'pending_review->returned_for_modification', 'pending_review->cancelled',
    -- from returned_for_modification
    'returned_for_modification->in_progress', 'returned_for_modification->pending_review', 'returned_for_modification->cancelled',
    -- from reopened
    'reopened->in_progress', 'reopened->pending_review', 'reopened->assigned', 'reopened->cancelled',
    -- reopen of terminal states
    'completed->reopened', 'cancelled->reopened', 'rejected->reopened'
  ];
begin
  -- Only act when the status actually changes.
  if new.status is not distinct from old.status then
    return new;
  end if;

  transition := old.status::text || '->' || new.status::text;

  if not (transition = any (allowed)) then
    raise exception 'Illegal task status transition: % -> %', old.status, new.status
      using errcode = 'check_violation';
  end if;

  -- ── Side-effect column stamping ──
  if new.status = 'approved' then
    new.approved_by := coalesce(new.approved_by, auth.uid());
  elsif new.status = 'completed' then
    if new.closure_summary is null or btrim(new.closure_summary) = '' then
      raise exception 'closure_summary is required to complete a task'
        using errcode = 'not_null_violation';
    end if;
    if new.quality_rating is null then
      raise exception 'quality_rating is required to complete a task'
        using errcode = 'not_null_violation';
    end if;
    new.progress_percentage := 100;
    new.completed_at := now();
  elsif new.status = 'cancelled' then
    new.cancelled_at := now();
  elsif new.status = 'reopened' then
    new.reopened_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists guard_task_transition on public.tasks;
create trigger guard_task_transition
  before update of status on public.tasks
  for each row execute function public.validate_task_transition();

-- ── task_updates (IMMUTABLE — no updated_at) ──────────────────────────────
create table if not exists public.task_updates (
  id                       uuid primary key default gen_random_uuid(),
  task_id                  uuid not null references public.tasks(id) on delete cascade,
  updated_by               uuid not null references public.profiles(id),
  progress_percentage      integer not null check (progress_percentage between 0 and 100),
  status_update_comment    text,
  latest_action            text,
  next_action              text,
  challenges_blockers      text,
  required_support         text,
  expected_completion_date date,
  created_at               timestamptz not null default now()
);

create index if not exists idx_task_updates_task_id on public.task_updates (task_id);

-- A progress update syncs the parent task's progress and auto-advances
-- assigned/approved/pending_update tasks to in_progress.
create or replace function public.apply_task_update()
returns trigger
language plpgsql
as $$
begin
  update public.tasks t
  set
    progress_percentage = new.progress_percentage,
    latest_action       = coalesce(new.latest_action, t.latest_action),
    next_action         = coalesce(new.next_action, t.next_action),
    challenges_blockers = coalesce(new.challenges_blockers, t.challenges_blockers),
    required_support    = coalesce(new.required_support, t.required_support),
    status              = case
                            when t.status in ('assigned', 'approved', 'pending_update')
                              then 'in_progress'::public.task_status
                            else t.status
                          end
  where t.id = new.task_id;

  return new;
end;
$$;

drop trigger if exists on_task_update_created on public.task_updates;
create trigger on_task_update_created
  after insert on public.task_updates
  for each row execute function public.apply_task_update();

-- ── task_comments ─────────────────────────────────────────────────────────
create table if not exists public.task_comments (
  id            uuid primary key default gen_random_uuid(),
  task_id       uuid not null references public.tasks(id) on delete cascade,
  author_id     uuid not null references public.profiles(id),
  comment_role  public.user_role not null,
  comment_type  public.comment_type_enum not null default 'general',
  comment_text  text not null,
  is_addressed  boolean not null default false,
  addressed_by  uuid references public.profiles(id) on delete set null,
  addressed_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_task_comments_task_id on public.task_comments (task_id);

drop trigger if exists set_task_comments_updated_at on public.task_comments;
create trigger set_task_comments_updated_at
  before update on public.task_comments
  for each row execute function public.set_updated_at();

-- ── task_attachments ──────────────────────────────────────────────────────
create table if not exists public.task_attachments (
  id              uuid primary key default gen_random_uuid(),
  task_id         uuid not null references public.tasks(id) on delete cascade,
  uploaded_by     uuid not null references public.profiles(id),
  file_name       text not null,
  file_type       text not null,
  storage_path    text,
  file_url        text,
  file_size_bytes bigint,
  description     text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_task_attachments_task_id on public.task_attachments (task_id);

drop trigger if exists set_task_attachments_updated_at on public.task_attachments;
create trigger set_task_attachments_updated_at
  before update on public.task_attachments
  for each row execute function public.set_updated_at();
