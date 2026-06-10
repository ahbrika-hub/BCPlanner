-- Allow @tss.test to self-register alongside @saptco.com.
--
-- The signup domain allow-list lives in app_settings.signup_allowed_domains and
-- is read by handle_new_user(), which is ALREADY list-aware — it splits the
-- value on ',' (string_to_array(value, ',')) and rejects any domain not in the
-- list. So enabling a second domain is purely a data change here; no function
-- change is required. The matching app-layer constant (ALLOWED_SIGNUP_DOMAINS in
-- src/lib/validations/auth.ts) is updated in the same PR so both layers agree.
--
-- Format note: the value MUST be lowercase and space-free — handle_new_user
-- compares the (lowercased) email domain against the raw split tokens, so a
-- space (e.g. 'saptco.com, tss.test') would fail to match 'tss.test'.
--
-- Idempotent: re-running sets the same value; pending/inactive + approval
-- gating is untouched.

insert into public.app_settings (key, value, description)
values (
  'signup_allowed_domains',
  'saptco.com,tss.test',
  'Comma-separated, lowercase email domains permitted to self-register.'
)
on conflict (key) do update
  set value = excluded.value;
