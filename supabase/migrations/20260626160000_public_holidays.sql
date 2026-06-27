-- Public-holiday capacity calendar. An admin-editable reference table the central
-- working-day helper subtracts from capacity (8h × Sun–Thu working days MINUS any
-- public_holidays in range). Mirrors the business_lines / app_settings reference
-- pattern: SELECT for all authenticated users (holidays are non-sensitive and
-- capacity is shown to every workload viewer); write gated by the EXISTING
-- settings.manage permission (held by admin + section_head) — the same key that
-- gates business_lines / app_settings. No new permission key is added, so no
-- per-role totals change. Does not touch the task lifecycle.

create table if not exists public.public_holidays (
  id           uuid primary key default gen_random_uuid(),
  holiday_date date not null unique,
  name         text not null check (char_length(name) between 1 and 120),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_public_holidays_date
  on public.public_holidays (holiday_date);

-- updated_at trigger (same convention as projects / business_lines / app_settings).
drop trigger if exists set_public_holidays_updated_at on public.public_holidays;
create trigger set_public_holidays_updated_at
  before update on public.public_holidays
  for each row execute function public.set_updated_at();

alter table public.public_holidays enable row level security;

-- ── RLS: read for all authenticated; write via settings.manage ───────────────
drop policy if exists public_holidays_select on public.public_holidays;
create policy public_holidays_select on public.public_holidays
  for select to authenticated
  using (true);

drop policy if exists public_holidays_write on public.public_holidays;
create policy public_holidays_write on public.public_holidays
  for all to authenticated
  using (public.authorize('settings.manage'))
  with check (public.authorize('settings.manage'));

-- ── Seed: Saudi Arabia 2026 public holidays (best-known Gregorian dates) ─────
-- IMPORTANT: The Hijri-based Eid holidays (Eid al-Fitr, Eid al-Adha) are subject
-- to official MOON-SIGHTING and are ESTIMATES here — a starting point, NOT
-- authoritative. They are admin-editable: once the Saudi authorities announce the
-- official dates, an admin should correct these rows via the holidays admin UI.
-- Founding Day (Feb 22) and National Day (Sep 23) are fixed Gregorian dates.
insert into public.public_holidays (holiday_date, name) values
  ('2026-02-22', 'Founding Day'),
  ('2026-03-20', 'Eid al-Fitr (estimated)'),
  ('2026-03-21', 'Eid al-Fitr (estimated)'),
  ('2026-03-22', 'Eid al-Fitr (estimated)'),
  ('2026-03-23', 'Eid al-Fitr (estimated)'),
  ('2026-05-27', 'Eid al-Adha (estimated)'),
  ('2026-05-28', 'Eid al-Adha (estimated)'),
  ('2026-05-29', 'Eid al-Adha (estimated)'),
  ('2026-05-30', 'Eid al-Adha (estimated)'),
  ('2026-09-23', 'Saudi National Day')
on conflict (holiday_date) do nothing;
