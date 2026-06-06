# User Onboarding Guide

How an **admin** creates and onboards each role in TSS Planner, the fix for the
"CEO wrong credentials" problem, and the SQL to recover profiles after a database
rebuild.

> Production: Supabase project `cssxmqwdeiibewucorjx` · App `https://bc-planner.vercel.app`.
> **Never paste secrets into code or commits.** All SQL below is run in the
> Supabase **Dashboard → SQL Editor** (which executes as a privileged role and
> bypasses RLS), or in the in-app **/admin/users** screen.

---

## 0. Mental model (read first)

- **A login is an `auth.users` row with a password.** It lives in Supabase Auth.
- **A profile is a `public.profiles` row** (role, department, active flag). It is
  created automatically by the `handle_new_user` trigger **the first time a user
  signs in / accepts an invite** — always as role **`employee`**.
- **A role (admin / ceo / section_head / employee) is a field on the profile**, not
  a separate account type. You *promote* a profile to change its role.
- The `(app)` layout blocks anyone whose profile is missing or `is_active = false`,
  redirecting to `/login?error=inactive`.

So onboarding is always two steps: **(1) create the auth account (with a password),
then (2) set the role/department.**

---

## 1. Create the FIRST admin (bootstrap)

Do this once. The database rebuild wiped `profiles`, so even if your login exists
you may have no profile yet.

1. **Create the login** (if you don't have one): Supabase Dashboard →
   **Authentication → Users → Add user / Invite** → your email. If you "Add user,"
   set a password directly; if you "Invite," open the email link and set a password.
2. **Create/activate your admin profile** — SQL Editor (replace the email):

   ```sql
   insert into public.profiles (id, full_name, email, role, is_active)
   select u.id,
          coalesce(u.raw_user_meta_data ->> 'full_name', 'Administrator'),
          u.email,
          'admin',
          true
   from auth.users u
   where u.email = 'you@domain.com'
   on conflict (id) do update
     set role = 'admin',
         is_active = true;
   ```

   This works whether the profile is missing (insert) or exists but
   inactive/wrong-role (update). The privilege guard intentionally allows
   SQL-console changes (no `auth.uid()`), so first-admin promotion succeeds.
3. **Sign out and back in** → you land on `/dashboard` with full navigation.

---

## 2. Create a CEO (fixes the "wrong credentials" problem)

**Why it fails today:** people try to "create a CEO user" expecting the app to set
a password — it doesn't. There is no create-user-with-password path in the app.
`inviteUserAction` only sends an invite (no password) and is disabled unless
`SUPABASE_SERVICE_ROLE_KEY` is set. If you create only a `profiles` row, or invite
someone who never set a password, `signInWithPassword` returns **"Invalid login
credentials."**

**Correct flow:**

1. **Create the auth account with a password.** Dashboard → **Authentication →
   Users**:
   - *Add user* → enter email + a temporary password (simplest), **or**
   - *Invite user* → the CEO opens the email link and sets their own password.
   On first sign-in/accept, `handle_new_user` auto-creates their profile as
   `employee`.
2. **Promote to `ceo`** — either:
   - In the app: **/admin/users** → find the user → set **Role = CEO**,
     **Department = Business Consulting**, **Status = Active** → Save; **or**
   - SQL Editor: `update public.profiles set role = 'ceo', is_active = true where email = 'ceo@domain.com';`
3. **CEO signs in** with the password from step 1.

> A `ceo` gets the executive dashboard and read-all + comment access, and is
> correctly **blocked** from `/admin/audit` and from creating/approving tasks.

---

## 3. Create a section_head

1. Dashboard → **Authentication → Add/Invite user** (set or let them set a password).
2. **/admin/users** → Role = **Section Head**, Department = **Business Consulting**,
   Status = **Active**.

A `section_head` can create/approve/assign tasks within their department, see
department workload, and run evaluations.

## 4. Create an employee

1. Dashboard → **Authentication → Add/Invite user**.
2. They sign in; `handle_new_user` makes them an `employee` automatically. If they
   should be in a department, set it in **/admin/users**.

No promotion needed unless changing department or activating/deactivating.

---

## 5. In-app invites (after the service-role key is set)

Once `SUPABASE_SERVICE_ROLE_KEY` is configured in Vercel, admins can invite from
**/admin/users → Invite User** (calls `inviteUserAction` →
`auth.admin.inviteUserByEmail`). The invitee still **sets their own password via
the email link** before they can sign in, then you promote their role as above.

---

## 6. Recover profiles after a database rebuild (backfill)

If the `public` schema is ever rebuilt (as happened post-launch), all `profiles`
rows are lost while `auth.users` (logins) survive — so everyone is locked out with
`/login?error=inactive`. Re-create profiles for every orphaned auth user in one
idempotent statement (SQL Editor):

```sql
insert into public.profiles (id, full_name, email, role)
select u.id,
       coalesce(u.raw_user_meta_data ->> 'full_name', ''),
       coalesce(u.email, ''),
       'employee'
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
on conflict (id) do nothing;
```

Then re-promote admins/CEO/section heads (sections 1–3). The roadmap (Tier 1) turns
this into a permanent backfill migration so it runs automatically after any rebuild.

---

## 7. Quick reference

| Role | Create login | Set role | Notes |
|---|---|---|---|
| admin | Dashboard add/invite | SQL or /admin/users | First admin via SQL (section 1) |
| ceo | Dashboard add/invite (**must set password**) | /admin/users or SQL | No audit access; can't create/approve tasks |
| section_head | Dashboard add/invite | /admin/users | Department-scoped management |
| employee | Dashboard add/invite | auto (`employee`) | Set department if needed |

**Golden rule:** every account needs a **password set** (step 1) before login works
— that is the single most common onboarding mistake.
