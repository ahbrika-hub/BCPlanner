-- Effort-HOURS workload model: reclassify daily_employee_workload's workload_level
-- from the old task-COUNT thresholds (>5 high / >2 medium) to a HOURS-vs-capacity
-- utilization band, matching src/lib/workload/compute.ts levelFor():
--   over  (high)   : utilization_pct >  100
--   near  (medium) : utilization_pct >= 80
--   under (low)    : otherwise
--
-- utilization_pct stays hours-based: sum(estimated_effort_hours) / 8h (this view
-- is the single-day operational widget; the range-scoped Workload page computes
-- capacity — including public-holiday subtraction — in the central TS helper).
-- active_task_count is retained as the SECONDARY display. Tasks with a NULL
-- estimated_effort_hours contribute 0 hours (coalesce) but are still counted.
-- security_invoker is preserved. Does not touch the lifecycle.

create or replace view public.daily_employee_workload as
select
  p.id            as employee_id,
  p.full_name,
  p.department_id,
  count(t.id)     as active_task_count,
  coalesce(sum(t.estimated_effort_hours), 0) as total_estimated_hours,
  round(coalesce(sum(t.estimated_effort_hours), 0) / 8.0 * 100, 1) as utilization_pct,
  case
    when round(coalesce(sum(t.estimated_effort_hours), 0) / 8.0 * 100, 1) > 100 then 'high'
    when round(coalesce(sum(t.estimated_effort_hours), 0) / 8.0 * 100, 1) >= 80 then 'medium'
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

-- Make the view respect RLS of the calling user (unchanged).
alter view public.daily_employee_workload set (security_invoker = true);
