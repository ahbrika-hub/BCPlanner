-- Tighten the signup allow-list to exactly three entries, and teach
-- handle_new_user() to support full-email exceptions alongside domain entries:
--   saptco.com.sa         → DOMAIN  match (any address @saptco.com.sa)
--   tss.bc2026@gmail.com  → FULL-EMAIL match (that exact address only)
--   ahbrika@gmail.com     → FULL-EMAIL match (that exact address only)
-- so a specific gmail is allowed without opening the whole gmail.com domain.
--
-- Existing accounts are unaffected — the trigger fires on NEW auth signups only.
-- Idempotent: re-running sets the same value and replaces the function in place.

update public.app_settings
set value = 'saptco.com.sa,tss.bc2026@gmail.com,ahbrika@gmail.com'
where key = 'signup_allowed_domains';

-- Rewrite handle_new_user(): same behaviour (force employee, pending self-signups,
-- notify approvers) with a two-mode allow-list check. The existing trigger on
-- auth.users calls this function by name, so no trigger change is needed.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_self_signup boolean := coalesce(new.raw_user_meta_data ->> 'self_signup', '') = 'true';
  v_allowed     text;
  v_email       text := lower(coalesce(new.email, ''));
  v_domain      text := lower(split_part(coalesce(new.email, ''), '@', 2));
  v_status      public.account_status;
begin
  -- Email allow-list (defense in depth). Enforced for real auth-service signups —
  -- GoTrue connects as supabase_auth_admin — so even a direct anon API signup is
  -- rejected. SQL/seed/test inserts run as a superuser role and are trusted, so
  -- they bypass (keeps `supabase db reset` fixtures working). Each comma entry is
  -- a DOMAIN match unless it contains '@', in which case it's a FULL-EMAIL match.
  if session_user = 'supabase_auth_admin' then
    select value into v_allowed
    from public.app_settings where key = 'signup_allowed_domains';
    if v_allowed is not null and not exists (
      select 1
      from unnest(string_to_array(v_allowed, ',')) as t(entry)
      where case
              when position('@' in entry) > 0 then v_email = entry
              else v_domain = entry
            end
    ) then
      raise exception 'Registration is limited to: %', v_allowed
        using errcode = 'check_violation';
    end if;
  end if;

  -- Self-signups are pending + inactive until approved; everything else
  -- (admin invites, SQL fixtures) stays active. Role is ALWAYS employee here —
  -- privilege assignment is an explicit approve/admin action.
  v_status := case when v_self_signup then 'pending' else 'active' end;

  insert into public.profiles (id, full_name, email, role, account_status, is_active)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.email, ''),
    'employee',
    v_status,
    v_status = 'active'
  )
  on conflict (id) do nothing;

  -- Notify approvers (admin + section_head) of a new pending registration.
  if v_self_signup then
    insert into public.notifications (user_id, type, title, message)
    select pr.id, 'system',
           'New registration pending approval',
           coalesce(new.email, 'A new user')
             || ' has registered and is awaiting approval.'
    from public.profiles pr
    where pr.role in ('admin', 'section_head') and pr.is_active = true;
  end if;

  return new;
end;
$$;
