# Database

The complete BCPlanner data layer: schema, enums, RLS, the `authorize()` model,
task numbering, the workload view, and operational notes. After this phase the
database is production-ready; no further schema work is required before building
UI.

Migrations live in `supabase/migrations/` (idempotent, applied in timestamp
order). Reference/seed data is in `supabase/seed.sql`. RLS tests are in
`supabase/tests/rls_test.sql`.

## Table inventory

| Table                            | Purpose                                                                                                        |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `profiles`                       | One row per `auth.users` user (created by the `on_auth_user_created` trigger). Holds role, department, status. |
| `departments`                    | Departments (single department: Business Consulting).                                                          |
| `permissions`                    | Permission catalogue (`key`, `category`).                                                                      |
| `role_permissions`               | Maps each `user_role` to permission keys. Drives `authorize()`.                                                |
| `business_lines`                 | The 7 business lines (TSS, Merapp, ARTC, Driving School, Dealership, Corporate, General).                      |
| `app_settings`                   | Key/value app configuration (e.g. `due_soon_threshold`, `no_update_threshold`).                                |
| `tasks`                          | Core task records with lifecycle status, assignment, effort, closure fields.                                   |
| `task_updates`                   | **Immutable** progress updates; syncs task progress and auto-advances to `in_progress`.                        |
| `task_comments`                  | Threaded comments (general / task-specific / CEO office).                                                      |
| `task_attachments`               | File/link attachments for tasks.                                                                               |
| `task_no_counters`               | Per-year atomic counter backing `task_no` generation.                                                          |
| `recurring_tasks`                | Recurring task templates (weekly/monthly/quarterly).                                                           |
| `performance_evaluations`        | Per-employee, per-period performance records.                                                                  |
| `notifications`                  | Per-user notifications.                                                                                        |
| `audit_logs`                     | **Immutable** audit trail (service/trigger-written only).                                                      |
| `daily_employee_workload` (view) | Per-employee active workload; `security_invoker`.                                                              |

## Enums

- **`user_role`**: `admin`, `section_head`, `employee`, `ceo`
- **`task_status`** (12): `draft`, `pending_approval`, `approved`, `assigned`,
  `in_progress`, `pending_update`, `pending_review`, `completed`, `rejected`,
  `returned_for_modification`, `cancelled`, `reopened`
- **`task_priority`**: `low`, `medium`, `high`, `critical`
- **`recurrence_freq`**: `weekly`, `monthly`, `quarterly`
- **`comment_type_enum`**: `general`, `task_specific`, `ceo_office_comment`
- **`notification_type`**: `task_assigned`, `task_approved`, `task_rejected`,
  `task_returned`, `task_review_requested`, `task_completed`, `task_cancelled`,
  `task_reopened`, `comment_added`, `system`

## Authorization model — `authorize()`

`public.authorize(requested_permission text) returns boolean` is the single
permission gate, used throughout RLS:

```sql
-- true if the current user's (active) profile role holds the permission key
using (public.authorize('tasks.read_all'))
```

It is `STABLE SECURITY DEFINER` with an empty `search_path`, joining
`role_permissions → permissions → profiles` on `auth.uid()` and
`is_active = true`. With no authenticated user it returns `false` (never errors).

Every logged-in user connects as the single Postgres role `authenticated`; their
application role comes from their JWT (`auth.uid()` → `profiles.role`).

### Permission catalogue (by role)

- **employee** (17): create/read/update own tasks, submit for review, task
  updates, comments, attachments, own workload/performance/reports,
  notifications, standard dashboard.
- **section_head** (43): all employee permissions plus read-all, approve/reject/
  return/assign/close/cancel/reopen, address comments, manage recurring tasks,
  evaluate performance, settings, user management, audit read, manage projects.
- **ceo** (14): executive + standard dashboard, read-all tasks/reports, comment,
  download attachments, notifications, **plus create tasks and request updates on
  their own requests** (`tasks.create`, `tasks.request_update`). The CEO no
  longer holds `workload.read_all` / `performance.read_all`.
- **admin** (46): every permission **except** `tasks.request_update` (a CEO-only
  nudge), including `roles.manage`.

> **Permission reconciliation (authoritative source: `docs/FEATURE_INVENTORY.md`,
> computed by applying all migrations to a Postgres 16 replica and querying
> `role_permissions`).** Catalogue: **47** total permission keys. Per-role grant
> totals: **admin 46 · section_head 43 · employee 17 · ceo 14**. These supersede
> the earlier "38 / 15 / 35 / 10" figures, which predated the project, CEO-role,
> and template permission changes.
>
> **Permission tidy (this PR — migration `20260626140000`).** Three *decorative*
> grants that nothing consults (`dashboard.executive` — the Executive view is
> gated by `role = 'ceo'`; `task_comments.read` and `task_updates.read` — their
> tables' visibility is enforced by task-visibility RLS) are removed from
> `role_permissions`. The catalogue size is unchanged (47 keys; only grants are
> removed). **Post-tidy per-role grant totals: admin 43 · section_head 41 ·
> employee 15 · ceo 12.**
>
> **Decision item — `employee` holds `reports.read`.** The seed grants
> `reports.read` to `employee` (alongside `workload.read` and
> `performance.read`), so employees can open `/reports` (the route allows
> `reports.read` **OR** `reports.read_all` as of PR #43). If reporting should be
> management-only, revoke `reports.read` from `employee` in a future migration —
> that is a deliberate permission change and is intentionally **not** made here.

## RLS summary

RLS is **enabled on all 15 tables** with default-deny. Highlights:

| Table                                                             | Read                                  | Write                                                                                                        |
| ----------------------------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `profiles`                                                        | own row or `users.read`               | own row or `users.manage`; INSERT via trigger                                                                |
| `departments` / `business_lines` / `app_settings` / `permissions` | any active user                       | `users.manage` / `settings.manage` / `roles.manage`                                                          |
| `role_permissions`                                                | `roles.manage`                        | `roles.manage`                                                                                               |
| `tasks`                                                           | own, assigned, or `tasks.read_all`    | INSERT: `tasks.create` & own; UPDATE: own/assignee+`tasks.update` or read-all+update; DELETE: `tasks.delete` |
| `task_updates`                                                    | follows task visibility               | INSERT: `task_updates.create` on own assigned task (or read-all); **no UPDATE/DELETE (immutable)**           |
| `task_comments`                                                   | follows task visibility               | INSERT: `task_comments.create` + author is self + visible task; UPDATE: `task_comments.address`              |
| `task_attachments`                                                | `attachments.download` + task visible | INSERT: `attachments.upload` + uploader self + visible; DELETE: own or `tasks.delete`                        |
| `recurring_tasks`                                                 | `recurring.manage`                    | `recurring.manage`                                                                                           |
| `performance_evaluations`                                         | own or `performance.read_all`         | INSERT/UPDATE: `performance.evaluate`; DELETE: evaluate + `users.manage`                                     |
| `notifications`                                                   | own only                              | UPDATE own (mark read); DELETE own (`notifications_delete`, owner-scoped, added `20260609092611`); **no client INSERT**          |
| `audit_logs`                                                      | `audit.read`                          | **never from clients**                                                                                       |
| `task_no_counters`                                                | —                                     | **never from clients** (written only by `generate_task_no()`)                                                |

The RLS test suite (`supabase/tests/rls_test.sql`) asserts 22 behaviours across
all four roles and must pass before merge.

## Task numbering — `task_no`

Format: **`TSS-BC-YYYY-NNNN`** (e.g. `TSS-BC-2026-0001`). On insert, the
`set_task_no` trigger calls `generate_task_no()` (SECURITY DEFINER), which
atomically increments `task_no_counters` for the current year via an upsert and
zero-pads the sequence to 4 digits. The counter is per-year.

## Task lifecycle guard

`validate_task_transition()` (BEFORE UPDATE OF status on `tasks`) enforces the
legal state machine and raises on illegal transitions. It also stamps
side-effects:

- `→ approved`: sets `approved_by` (defaults to `auth.uid()`).
- `→ completed`: requires `closure_summary` and `quality_rating`; sets
  `progress_percentage = 100` and `completed_at`.
- `→ cancelled`: sets `cancelled_at`.
- `→ reopened`: sets `reopened_at`.

Actor/role enforcement (who may approve, etc.) is handled by RLS + the
application layer; the guard enforces the state machine and column stamping.

A progress update (`task_updates` insert) syncs `tasks.progress_percentage` and
auto-advances `assigned`/`approved`/`pending_update` tasks to `in_progress`.

## Workload view

`daily_employee_workload` aggregates each active employee's **active** tasks
(`assigned`, `in_progress`, `approved`, `pending_update`, `pending_review`,
`returned_for_modification`, `reopened`). Workload level:

- `active_task_count > 5` → **high**
- `active_task_count > 2` → **medium**
- otherwise → **low**

The view is `security_invoker = true`, so it respects the caller's RLS.

## Type generation

```bash
npm run types:gen   # Supabase CLI -> src/types/database.types.ts
```

The CLI path requires Docker (local stack) or an authenticated CLI. When Docker
is unavailable, the same output can be produced against a plain PostgreSQL
database using the `@supabase/postgres-meta` engine (the engine the CLI wraps).
`src/types/database.types.ts` is **auto-generated — do not hand-edit**.

## First admin user setup

**No admin user is seeded.** New signups always become `employee` (forced by
`handle_new_user()`). To create the first admin:

1. In the Supabase Dashboard: **Authentication → Users → Invite user** (or have
   the user sign up).
2. Promote them via SQL (Dashboard SQL editor or `psql`):

   ```sql
   update public.profiles set role = 'admin' where email = 'admin@yourdomain.com';
   ```

Thereafter, admins/section heads manage roles through the application.
