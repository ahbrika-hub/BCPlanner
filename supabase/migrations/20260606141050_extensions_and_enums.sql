-- Migration 1: extensions_and_enums
-- Enables required extensions and creates all application ENUM types.
-- Idempotent: safe to run repeatedly.

-- ── Extensions ────────────────────────────────────────────────────────────
create extension if not exists pgcrypto;

-- ── ENUM types ────────────────────────────────────────────────────────────
-- Idempotent creation pattern: only create the type if it does not yet exist.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type public.user_role as enum ('admin', 'section_head', 'employee', 'ceo');
  end if;
end
$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'task_status') then
    create type public.task_status as enum (
      'draft',
      'pending_approval',
      'approved',
      'assigned',
      'in_progress',
      'pending_update',
      'pending_review',
      'completed',
      'rejected',
      'returned_for_modification',
      'cancelled',
      'reopened'
    );
  end if;
end
$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'task_priority') then
    create type public.task_priority as enum ('low', 'medium', 'high', 'critical');
  end if;
end
$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'recurrence_freq') then
    create type public.recurrence_freq as enum ('weekly', 'monthly', 'quarterly');
  end if;
end
$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'comment_type_enum') then
    create type public.comment_type_enum as enum ('general', 'task_specific', 'ceo_office_comment');
  end if;
end
$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'notification_type') then
    create type public.notification_type as enum (
      'task_assigned',
      'task_approved',
      'task_rejected',
      'task_returned',
      'task_review_requested',
      'task_completed',
      'task_cancelled',
      'task_reopened',
      'comment_added',
      'system'
    );
  end if;
end
$$;
