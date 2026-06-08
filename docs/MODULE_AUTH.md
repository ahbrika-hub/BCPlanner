# Auth — login + self-registration

## Login (`/login`)

Email + password via `signIn` (server action → `supabase.auth.signInWithPassword`).
The TSS logo (`/brand/tss-logo.svg`, falling back to the text wordmark) sits at
the top; a **Sign up** link points to `/signup`. The page surfaces notices for
`?confirmed=1` (email confirmed), `?error=pending` (awaiting approval), and
`?error=inactive` (deactivated).

## Self-registration (`/signup`)

Restricted to **@saptco.com** addresses. Public, anonymous flow — no service-role
key required.

1. `signUp` server action validates `signupSchema` (full name, email domain,
   password ≥ 8, confirm match), then calls `supabase.auth.signUp` with email
   confirmation and `data: { self_signup: "true", full_name }`.
2. The `on_auth_user_created` trigger (`handle_new_user`) — **defence in depth**:
   - Forces `role = employee` (never a privileged role).
   - Re-checks the email domain against `app_settings.signup_allowed_domains`
     for real auth-service signups (`session_user = supabase_auth_admin`), so
     even a direct anon API call with a non-saptco address is rejected. SQL /
     seed inserts (superuser) bypass this so `supabase db reset` fixtures work.
   - Marks self-signups `account_status = pending`, `is_active = false`.
   - Notifies all active **admin + section_head** users in-app.
3. The new account cannot reach protected routes: the `(app)` layout redirects
   `is_active = false` users to `/login` (pending → `?error=pending`), and
   `authorize()` / `get_my_permissions()` return nothing for inactive profiles.

## Approval

A pending registration is activated from **User Management** (`/admin/users`,
gated `users.read` → admin + section_head). The **Pending registrations** panel
(shown when the viewer holds `signups.approve`) lets an approver pick a role +
business line and **Approve** (`approveSignupAction`).

- `signups.approve` is a **narrow** permission granted to **admin + section_head
  only** (ceo / employee cannot). Full user CRUD stays on `users.manage`.
- `guard_profile_privileges` enforces the same at the DB: changing
  `role / department_id / is_active / account_status` requires
  `users.manage` **or** `signups.approve`.

### Account status

`profiles.account_status` ∈ `pending | active | inactive` (default `active`).
`is_active` is kept in lock-step (`pending`/`inactive` ⇒ `is_active = false`) so
all existing `is_active` guards/policies continue to apply unchanged.
