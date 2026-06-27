-- Parent-completion guard helper (application-layer rule, enforced in
-- transitionTaskAction; validate_task_transition is NOT modified).
--
-- WHY a SECURITY DEFINER function (and thus this small migration) rather than a
-- plain RLS-scoped query: the rule is "a parent cannot enter pending_review
-- while any CHILD is open". A child may be assigned to / created by someone other
-- than the parent's submitter, so an RLS-scoped count (run in the submitter's
-- visibility) could MISS open children the submitter can't see — letting them
-- bypass the rule. This mirrors the dependency/parent CYCLE checks added in the
-- previous PR, which are SECURITY DEFINER for exactly the same completeness
-- reason. The function returns ONLY non-terminal children of one parent (id +
-- task_no), so it discloses nothing beyond "this parent has these open subtasks"
-- to a caller already acting on the parent. It does NOT broaden task RLS.
--
-- Terminal = completed / cancelled / rejected (locked deadlock-avoidance set:
-- a cancelled/rejected child must never permanently block its parent).
create or replace function public.open_subtasks(p_parent_id uuid)
returns table (id uuid, task_no text)
language sql
stable
security definer
set search_path = ''
as $$
  select t.id, t.task_no
  from public.tasks t
  where t.parent_id = p_parent_id
    and t.status not in ('completed', 'cancelled', 'rejected')
  order by t.task_no;
$$;

grant execute on function public.open_subtasks(uuid) to authenticated;
