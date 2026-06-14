-- Migration: CEO role refinement
-- ----------------------------------------------------------------------------
-- Refines the ceo role's permissions (no other role is touched):
--   • GRANT  ceo  tasks.create        — a CEO can start a task. It lands
--                                        pending_approval + UNASSIGNED and flows
--                                        through the normal section_head/admin
--                                        approve+assign pipeline (same as an
--                                        employee-created task). No approve /
--                                        assign / update perms are granted.
--   • REVOKE ceo  performance.read_all — removes Performance from the CEO nav +
--   • REVOKE ceo  workload.read_all      page (both gated any-of read/read_all;
--                                        ceo holds only the *_all variants, so
--                                        these are the keys to remove).
--
-- ceo retains tasks.read_all (the executive dashboard's org-wide aggregates rely
-- on it; individual task-detail drilldown is gated in the app layer, not here).
--
-- Idempotent: safe to run repeatedly.

-- ── GRANT tasks.create ──────────────────────────────────────────────────────
insert into public.role_permissions (role, permission_id)
select 'ceo', p.id
from public.permissions p
where p.key = 'tasks.create'
on conflict (role, permission_id) do nothing;

-- ── REVOKE performance.read_all + workload.read_all ─────────────────────────
delete from public.role_permissions rp
using public.permissions p
where rp.permission_id = p.id
  and rp.role = 'ceo'
  and p.key in ('performance.read_all', 'workload.read_all');

-- ── Verification (fails the migration if the end-state is wrong) ────────────
do $$
declare
  ceo_has integer;
begin
  -- expect: tasks.create present (1), performance.read_all + workload.read_all absent (0).
  select count(*) into ceo_has
  from public.role_permissions rp
  join public.permissions p on p.id = rp.permission_id
  where rp.role = 'ceo' and p.key = 'tasks.create';
  if ceo_has <> 1 then
    raise exception 'CEO should hold tasks.create after this migration (found %)', ceo_has;
  end if;

  select count(*) into ceo_has
  from public.role_permissions rp
  join public.permissions p on p.id = rp.permission_id
  where rp.role = 'ceo' and p.key in ('performance.read_all', 'workload.read_all');
  if ceo_has <> 0 then
    raise exception 'CEO should NOT hold performance.read_all/workload.read_all (found %)', ceo_has;
  end if;
end $$;
