-- Migration 8: workload_view
-- Per-employee active workload aggregation. security_invoker so the view
-- respects the calling user's RLS on profiles and tasks.
-- Idempotent.

create or replace view public.daily_employee_workload as
select
  p.id            as employee_id,
  p.full_name,
  p.department_id,
  count(t.id)     as active_task_count,
  coalesce(sum(t.estimated_effort_hours), 0) as total_estimated_hours,
  round(coalesce(sum(t.estimated_effort_hours), 0) / 8.0 * 100, 1) as utilization_pct,
  case
    when count(t.id) > 5 then 'high'
    when count(t.id) > 2 then 'medium'
    else 'low'
  end as workload_level
from public.profiles p
left join public.tasks t
  on t.assignee_id = p.id
  and t.status in (
    'assigned',
    'in_progress',
    'approved',
    'pending_update',
    'pending_review',
    'returned_for_modification',
    'reopened'
  )
where p.is_active = true
group by p.id, p.full_name, p.department_id;

-- Make the view respect RLS of the calling user.
alter view public.daily_employee_workload set (security_invoker = true);
