-- Live-on-acceptance read for the weekly dashboard (PR-D2). Additive only — no
-- change to dashboard_snapshots / tasks RLS, permissions, or the upload path.
--
-- The dashboard must show the latest snapshot whose linked "Dashboard Update"
-- task is COMPLETED (accepted by section_head/admin), OR that has no linked task
-- (admin seed / sample data → always live). The completed-check must NOT depend
-- on the VIEWER being able to see that task: a ceo/employee viewer is scoped out
-- of other people's tasks by tasks RLS. So the join runs inside a SECURITY
-- DEFINER function (bypassing task RLS) while still gating the read on the
-- caller's dashboard.read — mirroring the dashboard_snapshots SELECT policy.

create or replace function public.get_latest_live_snapshot()
returns table (week_start date, created_at timestamptz, data jsonb)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  -- Gate: only dashboard.read callers get data (auth.uid() is the viewer, even
  -- though this function is SECURITY DEFINER). Same gate as the table's RLS.
  if not public.authorize('dashboard.read') then
    return;
  end if;

  return query
    select s.week_start, s.created_at, s.data
    from public.dashboard_snapshots s
    left join public.tasks t on t.id = s.task_id
    -- LIVE = no linked task (seed/sample) OR its task is accepted (completed).
    where s.task_id is null or t.status::text = 'completed'
    order by s.week_start desc, s.created_at desc
    limit 1;
end;
$$;

-- Only authenticated callers; the in-function authorize() does the real gating.
revoke all on function public.get_latest_live_snapshot() from public;
grant execute on function public.get_latest_live_snapshot() to authenticated;
