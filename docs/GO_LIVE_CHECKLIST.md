# Go-Live Checklist & Runbook

Takes TSS Planner from feature-complete to verified-in-production. Steps are
labelled **[Claude]** (done in code / this PR) or **[Ahmed]** (manual, needs
dashboard access or production credentials). **No secret is ever hardcoded.**

> **Status — 2026-06-06:** The app is **live** at https://bc-planner.vercel.app.
> Production DB has been rebuilt and **all 16 migrations + reference data are
> applied** (✅ §1). Auth works. **Remaining gates:** rotate the service-role keys
> + set Vercel env (§3), (re)create the first admin profile and onboard users
> (§6 / [ONBOARDING.md](./ONBOARDING.md)). See [SYSTEM_STATE.md](./SYSTEM_STATE.md)
> for the full live status table.

---

## 1. Production database sync (DO THIS FIRST)

Production: `cssxmqwdeiibewucorjx` · Staging: `kgfhnskldifoucmpsur`.

**[Claude]** Reference data is a versioned, idempotent migration
(`20260606171529_reference_data_seed.sql`) so it ships via `db push` — without
the permission catalogue + `role_permissions`, even an admin is locked out. The
full migration set (16 files, incl. the one-time
`20260606140000_reset_legacy_public_schema.sql`) was validated on PostgreSQL 16
(see §1.2).

**✅ DONE — production migrations are applied.** Production was rebuilt this
session and all 16 migrations + reference data are live, applied automatically by
the `db-push-production.yml` workflow on merge to `main` (and re-runs are clean
no-ops). The manual command below is kept for reference / disaster recovery:

```bash
supabase login                              # if not already
supabase link --project-ref cssxmqwdeiibewucorjx
supabase db push                            # applies ALL migrations (incl. reference_data_seed)
```

`db push` does **not** run `supabase/seed.sql`, but the reference data lives in a
migration, so `db push` is sufficient. (Alternatively, paste `supabase/seed.sql`
into the Dashboard SQL editor — it's idempotent.)

### 1.2 Verify production (run read-only in the Dashboard SQL editor)

Expected results shown — these passed on the validated schema:

```sql
-- 15 base tables
select count(*) from information_schema.tables
  where table_schema='public' and table_type='BASE TABLE';            -- 15

-- all 8 functions present
select proname from pg_proc where proname in
 ('authorize','get_my_permissions','generate_task_no','create_notification',
  'generate_due_recurring_tasks','guard_profile_privileges','handle_new_user','notify_role')
 order by proname;                                                    -- 8 rows

select role, count(*) from public.role_permissions group by role;     -- admin 38, section_head 35, employee 15, ceo 10
select count(*) from public.permissions;                              -- 38
select string_agg(name, ', ' order by sort_order) from public.business_lines;
                                                                      -- TSS, Merapp, ARTC, Driving School, Dealership, Corporate, General
-- every public table has RLS
select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind='r' and not c.relrowsecurity;  -- 0

-- the admin profile exists and is admin
select role, is_active from public.profiles where email = 'ADMIN_EMAIL_HERE';  -- admin, true
```

If `role_permissions` is empty or `get_my_permissions` is missing, that is the
cause of the earlier "Access restricted" symptom — `db push` fixes it.

> **First admin:** if no admin profile exists yet — invite yourself via
> Dashboard → Authentication → Invite User, then promote in the SQL editor:
> `update public.profiles set role='admin' where email='you@domain';`
> (The privilege guard skips SQL-console updates, so this works.)

---

## 2. Production verification (Part B)

**[Claude] automated:** `lint` / `typecheck` / `build` / unit tests green in CI;
RLS suite 22/22 on the current schema; production `/login` returns HTTP 200.

**[Ahmed] click-through on https://bc-planner.vercel.app as the admin** (expected
result in parentheses):

- [ ] Login → lands on `/dashboard`; **no "Access restricted"**; full nav visible
- [ ] Dashboard shows KPIs + charts in TSS burgundy/navy (operational view)
- [ ] `/tasks` → **New Task** → task appears → open detail → action bar shows the right buttons
- [ ] Lifecycle on a test task: create (→ pending_approval) → Approve → Assign → Log Progress (→ in_progress) → Submit for Review → Close (summary + rating) → **completed**
- [ ] Reject/Return records a reason comment + notifies the creator
- [ ] Comments thread works; attachment **upload** then **download** (signed URL) works
- [ ] `/approvals` queues populate; quick actions work
- [ ] `/workload` shows high/medium/low; `/notifications` list + bell badge update
- [ ] `/reports` filters + charts + **Export CSV**
- [ ] `/performance` score breakdown + **New Evaluation** saves
- [ ] `/recurring` create template + **Generate Due Tasks Now** creates a task
- [ ] `/admin/users` edit role/department/active persists; last-admin & self-lockout blocked
- [ ] `/admin/settings` thresholds save; `/admin/audit` filters + before/after diff
- [ ] No 500s; mobile responsive

---

## 3. Security hardening (Part F)

**[Claude] audit (clean):** no committed secrets; service-role key never
`NEXT_PUBLIC` and only referenced in server-only files; all 15 tables have RLS;
all 9 SECURITY DEFINER functions set `search_path=''`; attachments use signed
URLs; auth redirects via `proxy.ts` + the `(app)` layout gate.

**[Ahmed] MANUAL — required because the old service-role keys were exposed:**

1. **Rotate BOTH service-role keys** — Supabase Dashboard → Settings → API →
   reset `service_role` for **staging** AND **production**. This invalidates the
   exposed keys.
2. **Vercel env (Production scope, SERVER-ONLY — no `NEXT_PUBLIC_` prefix):**
   - `SUPABASE_SERVICE_ROLE_KEY` = the rotated **production** key
   - `CRON_SECRET` = a random string (for the recurring cron)
   - (optional, email) `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_ENABLED=true`
3. Confirm `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` point at
   production. Redeploy after setting env vars.

---

## 4. Recurring generation (Part D)

**[Claude]** `GET /api/cron/generate-recurring` (verifies `Bearer CRON_SECRET`,
calls `generate_due_recurring_tasks()` via the service-role client) + `vercel.json`
cron at `0 2 * * *` (daily). The manual **Generate Due Tasks Now** button remains
a fallback.

**[Ahmed]** Set `CRON_SECRET` in Vercel (§3.2). Until the service-role key is set,
the endpoint returns 503 (and the manual button still works).

---

## 5. Email notifications (Part E — optional, OFF by default)

**[Claude]** Feature-flagged Resend email (HTTP API, no SDK). Wired to the 4
events alongside in-app notifications: **Task Assigned** (assign), **Pending
Approval** (employee create), **Pending Review** (submit), **Completed** (close).
No-op unless `EMAIL_ENABLED=true` **and** `RESEND_API_KEY` + `EMAIL_FROM` are set;
failures never break an action. Recipient emails resolve via the service-role
client (RLS untouched).

**[Ahmed]** To enable later: set `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_ENABLED=true`
in Vercel. Email can stay OFF for initial go-live.

---

## 6. User onboarding runbook (Part G)

**Option 1 — works now (no service-role key needed):**

1. Supabase Dashboard → Authentication → **Invite User** → enter the email.
2. On first login, `handle_new_user` creates their profile as **employee**.
3. In the app at **/admin/users**, set their **role** (ceo / section_head /
   employee) and **department** (Business Consulting).

**Option 2 — after the service-role key is set:** invite directly from
**/admin/users** → Invite User in the app.

Fill in and work through:

| Name | Email | Role         |
| ---- | ----- | ------------ |
|      |       | ceo          |
|      |       | section_head |
|      |       | employee     |
|      |       | employee     |

> Once a user is `ceo`: executive dashboard, read-all + comment, and correctly
> **blocked** from `/admin/audit` and from creating/approving tasks.

---

## 7. Tests

- **Unit** (`npm run test`, vitest) — performance formula, period helpers, CSV; runs in CI.
- **RLS** (`supabase/tests/rls_test.sql`) — 22 assertions across all roles; run with
  `psql -f` against a local/staging DB. 22/22 on the current schema.
- **E2E** (`npm run test:e2e`, Playwright) — login/redirect, New Task dialog,
  permission gating. Set `PLAYWRIGHT_BASE_URL` (**staging**, never production) and
  `E2E_ADMIN_*` / `E2E_EMPLOYEE_*`; auth specs skip without creds.

---

## 8. Final go-live status

Code is production-ready and CI-green, the app is deployed, and the production
database is fully migrated + seeded. Remaining **[Ahmed]** manual steps:

1. ~~`supabase db push` to production~~ — **✅ DONE** (rebuilt this session; all 16
   migrations + reference data applied via the auto-deploy workflow).
2. **Rotate service-role keys**; set `SUPABASE_SERVICE_ROLE_KEY` + `CRON_SECRET` in
   Vercel; redeploy. *(Until done: cron returns 503, in-app invites disabled.)*
3. **(Re)create the first admin profile** — the rebuild wiped `profiles`; see
   [ONBOARDING.md](./ONBOARDING.md) §1. *(One-off SQL.)*
4. **Click through §2** as admin.
5. **Onboard** CEO + section heads + employees ([ONBOARDING.md](./ONBOARDING.md)).

The app is reachable and authentication works now; after steps 2–3 the admin has
full access, and after step 5 the team is live. A permanent profile-backfill
migration (so a rebuild never locks users out again) is tracked as Tier 1 in
[IMPROVEMENT_ROADMAP.md](./IMPROVEMENT_ROADMAP.md).
