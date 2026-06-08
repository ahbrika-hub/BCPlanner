-- Gate 3 — optional per-business-line logo override.
-- The dashboard resolves logos by convention first
-- (public/business-lines/<id>.svg|png, where <id> is the snapshot business-line
-- id), and uses this column only as an explicit override when set.
-- Idempotent. New migration.

alter table public.business_lines
  add column if not exists logo_url text;
