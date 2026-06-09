-- Allow a user to DELETE their own notifications (owner-scoped).
-- Additive + owner-scoped; no change to INSERT (service-role/triggers only),
-- SELECT, or UPDATE policies, and no change to creation logic/triggers.
-- Idempotent.

drop policy if exists notifications_delete on public.notifications;
create policy notifications_delete on public.notifications
  for delete to authenticated
  using (user_id = auth.uid());
