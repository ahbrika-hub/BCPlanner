-- Migration 6: work_modules
-- Recurring task templates and performance evaluations.
-- Idempotent.

-- ── recurring_tasks ───────────────────────────────────────────────────────
create table if not exists public.recurring_tasks (
  id                     uuid primary key default gen_random_uuid(),
  title                  text not null,
  description            text,
  category               text,
  business_line_id       uuid references public.business_lines(id) on delete set null,
  assignee_id            uuid references public.profiles(id) on delete set null,
  priority               public.task_priority not null default 'medium',
  frequency              public.recurrence_freq not null,
  start_date             date not null,
  next_generation_date   date not null,
  estimated_effort_hours numeric(6, 2),
  is_active              boolean not null default true,
  created_by             uuid not null references public.profiles(id),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index if not exists idx_recurring_tasks_active_nextgen
  on public.recurring_tasks (is_active, next_generation_date);

drop trigger if exists set_recurring_tasks_updated_at on public.recurring_tasks;
create trigger set_recurring_tasks_updated_at
  before update on public.recurring_tasks
  for each row execute function public.set_updated_at();

-- ── performance_evaluations ───────────────────────────────────────────────
create table if not exists public.performance_evaluations (
  id                     uuid primary key default gen_random_uuid(),
  employee_id            uuid not null references public.profiles(id) on delete cascade,
  period                 text not null,
  assigned_tasks_count   integer not null default 0,
  completed_tasks_count  integer not null default 0,
  delayed_tasks_count    integer not null default 0,
  avg_completion_days    numeric,
  update_frequency_score numeric,
  quality_avg_rating     numeric,
  returned_tasks_count   integer not null default 0,
  workload_level         text,
  overall_score          numeric(5, 2),
  evaluated_by           uuid not null references public.profiles(id),
  evaluation_notes       text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index if not exists idx_performance_evaluations_employee_id
  on public.performance_evaluations (employee_id);
create index if not exists idx_performance_evaluations_period
  on public.performance_evaluations (period);

drop trigger if exists set_performance_evaluations_updated_at on public.performance_evaluations;
create trigger set_performance_evaluations_updated_at
  before update on public.performance_evaluations
  for each row execute function public.set_updated_at();
