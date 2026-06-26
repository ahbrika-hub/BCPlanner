-- Permission tidy: remove three DECORATIVE role_permissions grants — keys that
-- are granted but consulted nowhere (no can()/authorize()/nav/RLS reference):
--   * dashboard.executive  — the Executive dashboard is gated by role = 'ceo',
--                            not by this key.
--   * task_comments.read   — comment visibility is enforced by task-visibility
--                            RLS (task_comments_select), not by this key.
--   * task_updates.read    — update visibility is enforced by task-visibility
--                            RLS (task_updates_select), not by this key.
--
-- Only the GRANTS are removed; the permission keys remain in the catalogue
-- (catalogue size unchanged at 47) so this is reversible and non-destructive.
-- Idempotent: a re-run deletes nothing. Touches role_permissions only — no
-- lifecycle, RLS, or storage changes.

delete from public.role_permissions rp
using public.permissions p
where rp.permission_id = p.id
  and p.key in (
    'dashboard.executive',
    'task_comments.read',
    'task_updates.read'
  );
