-- Migration 4: reference_data
-- Business lines and key/value application settings.
-- Idempotent.

-- ── business_lines ────────────────────────────────────────────────────────
create table if not exists public.business_lines (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  is_active  boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_business_lines_updated_at on public.business_lines;
create trigger set_business_lines_updated_at
  before update on public.business_lines
  for each row execute function public.set_updated_at();

-- ── app_settings ──────────────────────────────────────────────────────────
create table if not exists public.app_settings (
  key         text primary key,
  value       text not null,
  description text,
  updated_at  timestamptz not null default now()
);

drop trigger if exists set_app_settings_updated_at on public.app_settings;
create trigger set_app_settings_updated_at
  before update on public.app_settings
  for each row execute function public.set_updated_at();
