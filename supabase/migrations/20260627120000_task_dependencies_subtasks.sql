-- Structural task relationships — conservative, lifecycle-sacred.
--
-- (A) TASK DEPENDENCIES (block-START): a task can be "blocked by" other tasks.
--     The "cannot ENTER in_progress until all blockers are completed" rule is
--     enforced in the APPLICATION layer (addUpdateAction / transitionTaskAction),
--     NOT here — validate_task_transition is deliberately left untouched. This
--     migration adds only the relationship table, its RLS, and a DB-level CYCLE
--     guard (so a cycle can never be persisted, even outside the app).
--
-- (B) SUBTASKS (structural only): tasks.parent_id self-link + integrity guards
--     (no self-parent, no parent cycle). NO parent/child lifecycle coupling is
--     added here (the "parent can't complete with open children" rule is a
--     SEPARATE follow-up PR).
--
-- This migration does NOT modify validate_task_transition or generate_task_no.

-- ── Task visibility helper ──────────────────────────────────────────────────
-- Mirrors the tasks_select rule (creator OR assignee OR tasks.read_all) as a
-- reusable boolean so the dependency RLS can require visibility of BOTH the
-- blocked and the blocker task. SECURITY DEFINER (reads tasks regardless of the
-- caller's own row grants) + empty search_path per Supabase hardening; it only
-- ever reveals a boolean about the CALLER's own visibility (uses auth.uid()).
create or replace function public.can_see_task(p_task_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.tasks t
    where t.id = p_task_id
      and (
        t.created_by = auth.uid()
        or t.assignee_id = auth.uid()
        or public.authorize('tasks.read_all')
      )
  );
$$;

grant execute on function public.can_see_task(uuid) to authenticated;

-- ── (A) task_dependencies ───────────────────────────────────────────────────
create table if not exists public.task_dependencies (
  id                  uuid primary key default gen_random_uuid(),
  task_id             uuid not null references public.tasks(id) on delete cascade, -- the BLOCKED task
  depends_on_task_id  uuid not null references public.tasks(id) on delete cascade, -- the BLOCKER
  created_by          uuid references public.profiles(id) on delete set null,
  created_at          timestamptz not null default now(),
  unique (task_id, depends_on_task_id),
  check (task_id <> depends_on_task_id) -- no self-dependency
);

create index if not exists idx_task_dependencies_task_id
  on public.task_dependencies (task_id);
create index if not exists idx_task_dependencies_depends_on_task_id
  on public.task_dependencies (depends_on_task_id);

-- CYCLE PREVENTION (DB-enforced, cannot be bypassed by any client). Adding edge
-- "task_id depends_on depends_on_task_id" forms a cycle iff depends_on_task_id
-- already (transitively) depends on task_id. Walk the dependency chain forward
-- from the new blocker; if it reaches the blocked task, reject.
-- SECURITY DEFINER (empty search_path) so the recursive walk sees the COMPLETE
-- dependency graph regardless of the caller's RLS — otherwise a user who can't
-- see an intermediate edge could close a cycle through it undetected. This makes
-- cycle prevention global and un-bypassable. (It's a trigger function: it can't
-- be usefully invoked directly, so it exposes no privileged surface.)
create or replace function public.check_task_dependency_cycle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.task_id = new.depends_on_task_id then
    raise exception 'A task cannot depend on itself'
      using errcode = 'check_violation';
  end if;

  if exists (
    with recursive chain(node) as (
      select new.depends_on_task_id
      union
      select d.depends_on_task_id
      from public.task_dependencies d
      join chain c on d.task_id = c.node
    )
    select 1 from chain where node = new.task_id
  ) then
    raise exception 'Adding this dependency would create a cycle'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_task_dependency_cycle on public.task_dependencies;
create trigger guard_task_dependency_cycle
  before insert on public.task_dependencies
  for each row execute function public.check_task_dependency_cycle();

alter table public.task_dependencies enable row level security;

-- RLS: SELECT requires visibility of BOTH tasks. INSERT/DELETE additionally
-- require the task-edit permission (tasks.update) — the same key the task-edit
-- path checks — so only someone who could edit the blocked task (and can see
-- both) may add/remove its dependencies. (Visibility already implies creator/
-- assignee/manager; pairing it with tasks.update matches the edit gate without
-- re-deriving the per-row creator/assignee test in SQL.)
drop policy if exists task_dependencies_select on public.task_dependencies;
create policy task_dependencies_select on public.task_dependencies
  for select to authenticated
  using (
    public.can_see_task(task_id)
    and public.can_see_task(depends_on_task_id)
  );

drop policy if exists task_dependencies_insert on public.task_dependencies;
create policy task_dependencies_insert on public.task_dependencies
  for insert to authenticated
  with check (
    public.authorize('tasks.update')
    and public.can_see_task(task_id)
    and public.can_see_task(depends_on_task_id)
  );

drop policy if exists task_dependencies_delete on public.task_dependencies;
create policy task_dependencies_delete on public.task_dependencies
  for delete to authenticated
  using (
    public.authorize('tasks.update')
    and public.can_see_task(task_id)
    and public.can_see_task(depends_on_task_id)
  );

-- ── (B) subtasks: tasks.parent_id ───────────────────────────────────────────
alter table public.tasks
  add column if not exists parent_id uuid references public.tasks(id) on delete set null;

create index if not exists idx_tasks_parent_id on public.tasks (parent_id);

-- No self-parent (idempotent add).
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'tasks_parent_not_self') then
    alter table public.tasks
      add constraint tasks_parent_not_self check (parent_id is null or parent_id <> id);
  end if;
end $$;

-- Prevent parent CYCLES (A parent-of B, B parent-of A, …). Fires ONLY when
-- parent_id is set or changed — never on a status transition — so the lifecycle
-- path is untouched. (A brand-new task can't form a cycle since its id is new;
-- cycles could only arise from re-parenting, which this still guards.)
-- SECURITY DEFINER (empty search_path) for the same reason as the dependency
-- cycle check: the ancestor walk must see all tasks, not just the caller's
-- visible rows, so a parent cycle can't be closed through an unseen ancestor.
create or replace function public.check_task_parent_cycle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.parent_id is null then
    return new;
  end if;
  if new.parent_id = new.id then
    raise exception 'A task cannot be its own parent'
      using errcode = 'check_violation';
  end if;
  if exists (
    with recursive ancestors(node) as (
      select new.parent_id
      union
      select t.parent_id
      from public.tasks t
      join ancestors a on t.id = a.node
      where t.parent_id is not null
    )
    select 1 from ancestors where node = new.id
  ) then
    raise exception 'Setting this parent would create a subtask cycle'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_task_parent_cycle on public.tasks;
create trigger guard_task_parent_cycle
  before insert or update of parent_id on public.tasks
  for each row execute function public.check_task_parent_cycle();
