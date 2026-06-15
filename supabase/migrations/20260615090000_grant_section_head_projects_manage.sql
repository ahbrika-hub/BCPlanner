-- Migration: grant section_head projects.manage
-- ----------------------------------------------------------------------------
-- Lets section_head create/manage projects (previously admin-only), mirroring
-- the business_lines reference-table pattern. Full CRUD via the EXISTING
-- projects RLS: projects_write already authorizes('projects.manage') for
-- insert/update/delete (verified — no policy change here), and the app already
-- gates the /admin/projects route, the Projects nav item, and the create action
-- on can('projects.manage') (not role==='admin'), so no app change is needed.
--
-- Idempotent. No other role is changed.

insert into public.role_permissions (role, permission_id)
select 'section_head', p.id
from public.permissions p
where p.key = 'projects.manage'
on conflict (role, permission_id) do nothing;

-- ── End-state assertion ─────────────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1
    from public.role_permissions rp
    join public.permissions p on p.id = rp.permission_id
    where rp.role = 'section_head' and p.key = 'projects.manage'
  ) then
    raise exception 'section_head should hold projects.manage after this migration';
  end if;
end $$;
