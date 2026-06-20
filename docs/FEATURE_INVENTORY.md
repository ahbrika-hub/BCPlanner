# TSS Planner (BCPlanner) — Feature Inventory

> **Authoritative, code-derived inventory.** Everything below is derived strictly
> from the current repository (routes, components, `src/lib`, and
> `supabase/migrations`). Where existing docs disagree with the code, the code
> wins and the drift is recorded in §11. Per-role permission counts were computed
> by applying **all 34 migrations** to a Postgres 16 replica and querying
> `role_permissions` directly. Anything not confirmable from code is marked
> *unverified*.

---

## 1. Overview

TSS Planner is an internal, executive-grade task-management + dashboard portal for
the TSS Business Consulting department at SAPTCO. **Stack:** Next.js 16 (App
Router, RSC + server actions), React 19, TypeScript (strict), Tailwind v4 +
shadcn/ui, Recharts, Zod 4 + react-hook-form, Supabase (Postgres 16, Auth,
Storage, RLS), Resend (email, flag-gated), deployed on Vercel with GitHub Actions
applying migrations on merge. **Status:** live in production at
`https://bc-planner.vercel.app`. RBAC is permission-based: `permissions` /
`role_permissions` enforced by `authorize()` in SQL/RLS and `can()` in the app;
the session's permission set is loaded once per request via the
`get_my_permissions()` SECURITY DEFINER RPC (React `cache()`-wrapped). Four roles:
**admin, section_head, employee, ceo**.

---

## 2. Navigation & routes

Every `(app)/*` page is wrapped by `(app)/layout.tsx`, which redirects to `/login`
when unauthenticated and to `/login?error=pending|inactive` for non-active
profiles, then renders `AppShell` + the `@modal` parallel slot. Page-level guards
below are the **per-permission `can(...)` checks**; a missing permission renders an
inline "Access restricted" `EmptyState` (not a redirect), except where noted.

| Path | File (`src/app/`) | Gate | Description |
|---|---|---|---|
| `/` | `page.tsx` | public | `redirect("/dashboard")`. |
| `/dashboard` | `(app)/dashboard/page.tsx` | authenticated (nav: `dashboard.view`) | Role-routed: ceo→Executive, section_head/admin→Operational, else Personal. `?view=business-lines` → weekly (gated `dashboard.read`). |
| `/dashboard/weekly` | `(app)/dashboard/weekly/page.tsx` | `dashboard.read` (inside view) | Direct-URL weekly/Business-Lines snapshot. |
| `/tasks` | `(app)/tasks/page.tsx` | nav any-of `["tasks.read","tasks.create"]` | Task list + filters; **ceo** branch renders `CeoTasksView` (dept oversight, no assignee). Create entry gated `tasks.create`. |
| `/tasks/[id]` | `(app)/tasks/[id]/page.tsx` | `notFound()` if not visible; edit gated `tasks.update` + `tasks.read_all` | Full task detail. |
| `/approvals` | `(app)/approvals/page.tsx` | `tasks.approve` | Bulk approval/review queues. |
| `/notifications` | `(app)/notifications/page.tsx` | authenticated (nav: `notifications.read`) | Notifications list + bulk actions. |
| `/workload` | `(app)/workload/page.tsx` | any-of `workload.read`/`workload.read_all` | Capacity/utilization by period. |
| `/performance` | `(app)/performance/page.tsx` | any-of `performance.read`/`performance.read_all`; evaluate gated `performance.evaluate` | Own score or team evaluations. |
| `/recurring` | `(app)/recurring/page.tsx` | `recurring.manage` | Recurring-task templates manager. |
| `/reports` | `(app)/reports/page.tsx` | any-of `reports.read`/`reports.read_all` | KPIs/charts + CSV; "Delayed report" link gated `reports.read_all`. |
| `/reports/delayed` | `(app)/reports/delayed/page.tsx` | `reports.read_all` | Delayed-tasks breakdown (employee excluded). |
| `/projects/[id]` | `(app)/projects/[id]/page.tsx` | `tasks.read_all`; `notFound()` if missing | Project-health rollup + metric drilldown. **URL-only (no nav).** |
| `/admin/users` | `(app)/admin/users/page.tsx` | `users.read`; approve `signups.approve`; manage `users.manage`/`users.invite` | User mgmt + pending-signup approval. |
| `/admin/projects` | `(app)/admin/projects/page.tsx` | `projects.manage` | Projects reference manager. |
| `/admin/templates` | `(app)/admin/templates/page.tsx` | `templates.manage` | Task-template manager. |
| `/admin/settings` | `(app)/admin/settings/page.tsx` | `settings.read`; edit `settings.manage` | App settings form. |
| `/admin/audit` | `(app)/admin/audit/page.tsx` | `audit.read` | Read-only audit log (25/page). |
| `/login`, `/signup`, `/forgot-password` | `(auth)/*` | public (redirect if signed in) | Auth forms. |
| `/update-password` | `(auth)/update-password/page.tsx` | recovery session required | Set new password. |
| `/auth/confirm` | `auth/confirm/route.ts` (GET) | public token handler | OTP/email-link confirm → `verifyOtp`; safe `next` redirect. |
| `/api/cron/generate-recurring` | `api/cron/generate-recurring/route.ts` (GET) | **`CRON_SECRET` Bearer** (uses service-role key) | Calls `generate_due_recurring_tasks()`. |
| `/unauthorized` | `unauthorized/page.tsx` | public | Target of `requirePermission()` redirect (currently unused by pages). |

**Modal / parallel / intercepting routes (explicit):**
- `(app)/@modal/` — parallel slot rendered after `{children}`. `@modal/default.tsx` returns `null` (fallback on hard nav).
- `(app)/@modal/(.)tasks/[id]/page.tsx` — **intercepting route** (`(.)` same-level). It **intercepts soft navigations to `/tasks/[id]`** and renders `TaskDetailContent` inside `TaskDetailModal`; a hard load/refresh/deep-link falls through to the full `(app)/tasks/[id]/page.tsx`.

**Skeletons & boundaries:** every `(app)` page segment has a `loading.tsx` (17 total). `(app)/error.tsx` + root `global-error.tsx` are the error boundaries; there is **no `not-found.tsx`** (Next default 404). `nav-config.ts` filters items by `canSeeNavItem` = "session holds **any** of the item's permission key(s)"; empty groups are dropped.

---

## 3. Modules & sub-features (as implemented)

**Dashboard** (`src/components/dashboard/**`)
- **Department view** — role-selected: **Executive** (ceo, read-only: KPI cards + status chart + by-business-line bar + trend; **no drilldown**, charts lazy-loaded via `next/dynamic`); **Operational** (admin/section_head: drillable KPI cards + status-distribution drilldown + overdue list + trend); **Personal** (employee: own KPI cards — **clickable drilldown scoped to own tasks** — "needs my action" list + notifications).
- **Weekly / Business-Lines view** — snapshot-driven (`DASHBOARD_DATA` jsonb): per-line KPI groups, charts, tables; period switch (Week/MTD/YTD); business-line logos; **"Request update"** affordance (`dashboard.request_update`); reads the latest **live** snapshot via `get_latest_live_snapshot()`. Render-time `BL_SECTION_EXCLUSIONS` trims merapp's "Technician KPIs" table and artc's "Analysis Charts" section.
- **Drilldown** (`fetchDrilldownTasks`): role-scoped by the shared `getDrilldownScope(role)` — employee→own, section_head/admin→all, **ceo→none** — covering status/active/overdue/assignee-active and **project-health** keys.

**Tasks** (`src/components/tasks/**`, `tasks/page.tsx`)
- List with server-side **full-text search** (`search_vector`, 'simple') + task-no trigram, multi-**status** filter, **priority** filter, derived **overdue** toggle; client-side assignee/business-line filters + column sort (URL-persisted).
- **Create dialog** (reuses `createTaskSchema`): template prefill (`templates.read`), assignee/start/due/effort, SharePoint URL, department vs **project** category (+ project picker), and a **debounced assignee-workload preview** panel.
- **Edit dialog** (`updateTaskAction`, lazy-loaded) for descriptive fields.
- **CEO surfaces:** lightweight **"Request a task"** entry (→ pending_approval, unassigned, General line); **oversight `CeoTasksView`** (all dept tasks, **no assignee identity**, "Request update" on own requests via `request_task_update`).
- **Task detail:** status **action bar** (transition buttons per the lifecycle guard); **progress updates** with a read-only "Last update" panel + progress pre-fill; **comments** (incl. **CEO Office Comment**) + address; **attachments** upload/download (Storage signed URLs); **activity timeline**; SharePoint link; project link.

**Approvals** (`approvals/page.tsx`, `bulk-queue.tsx`) — two queues (Pending Approval / Pending Review); per-row `TaskActionBar`; **bulk** approve/reject/return/close with per-row results; **"CEO request"** badge + one-step **Convert & assign** dialog (`convertCeoRequestAction` = edit→approve→assign).

**Notifications** — list, mark read/unread, delete, mark-all-read; select-all bulk; unread badge in shell.

**Workload** — period filter (**Today / This week (Sun–Thu) / This month / Custom**); per-employee active hours, **work-week capacity (8h × Sun–Thu working days)**, utilization %, low/med/high; assignee drilldown.

**Performance** — per-employee quarterly (`YYYY-Qn`) evaluations: create/edit/delete (`performance.evaluate`), 40/30/30 composite preview, trend; employees see only their own.

**Recurring** — templates with frequency (weekly/monthly/quarterly); create/edit; **generate-due-now**; **soft-delete + restore** (`deleted_at`); active/inactive.

**Reports** — date-range + business-line + assignee filters; KPI cards + charts; **CSV export**; **Delayed report** (`reports.read_all`) — overdue breakdown by employee/line/priority + CSV.

**Projects** — `/admin/projects` CRUD (`projects.manage`, now incl. section_head); per-project **health rollup** (total/completed/in-progress/pending-review/overdue/avg-quality/completion%/avg-progress) with **clickable metric drilldowns** on `/projects/[id]`.

**Templates** — `/admin/templates` CRUD (`templates.manage`); reusable create-task defaults.

**Users** — `/admin/users`: list, invite, role/department/active edits (`users.manage`/`users.invite`), **pending-signup approval** (`signups.approve`).

**Settings** — `/admin/settings`: numeric app settings (due-soon / no-update thresholds) via `settings.manage`. *(The signup allow-list lives in `app_settings.signup_allowed_domains` + `src/lib/validations/auth.ts` — managed by migration, not this form.)*

**Audit** — `/admin/audit`: read-only, paginated status-change audit trail.

**Auth / signup / password-reset** — login, self-signup (allow-list enforced in `handle_new_user`; self-signups land **pending/inactive** and notify admins+section_heads), forgot/update password (Supabase recovery + `/auth/confirm`).

---

## 4. Permission catalog (computed from migrations)

**Catalogue total: 47 keys.** Per-role grant totals (authoritative, from the
replica): **admin 46 · section_head 43 · employee 17 · ceo 14.** `admin` holds
every key **except `tasks.request_update`** (a CEO-only nudge). Roles holding each
key:

| Module | Key | admin | section_head | employee | ceo |
|---|---|:--:|:--:|:--:|:--:|
| dashboard | dashboard.view | ✓ | ✓ | ✓ | ✓ |
| dashboard | dashboard.read | ✓ | ✓ | — | ✓ |
| dashboard | dashboard.executive | ✓ | — | — | ✓ |
| dashboard | dashboard.upload | ✓ | ✓ | — | — |
| dashboard | dashboard.request_update | ✓ | ✓ | — | ✓ |
| tasks | tasks.create | ✓ | ✓ | ✓ | ✓ |
| tasks | tasks.read | ✓ | ✓ | ✓ | — |
| tasks | tasks.read_all | ✓ | ✓ | — | ✓ |
| tasks | tasks.update | ✓ | ✓ | ✓ | — |
| tasks | tasks.delete | ✓ | — | — | — |
| tasks | tasks.approve / reject / return / assign / close / cancel / reopen | ✓ | ✓ | — | — |
| tasks | tasks.submit_review | ✓ | ✓ | ✓ | — |
| tasks | tasks.request_update | — | — | — | ✓ |
| task_updates | task_updates.create / read | ✓ | ✓ | ✓ | — |
| comments | task_comments.create / read | ✓ | ✓ | ✓ | ✓ |
| comments | task_comments.address | ✓ | ✓ | — | — |
| attachments | attachments.upload | ✓ | ✓ | ✓ | — |
| attachments | attachments.download | ✓ | ✓ | ✓ | ✓ |
| workload | workload.read | ✓ | ✓ | ✓ | — |
| workload | workload.read_all | ✓ | ✓ | — | — |
| performance | performance.read | ✓ | ✓ | ✓ | — |
| performance | performance.read_all | ✓ | ✓ | — | — |
| performance | performance.evaluate | ✓ | ✓ | — | — |
| reports | reports.read | ✓ | ✓ | ✓ | — |
| reports | reports.read_all | ✓ | ✓ | — | ✓ |
| recurring | recurring.manage | ✓ | ✓ | — | — |
| projects | projects.read | ✓ | ✓ | ✓ | ✓ |
| projects | projects.manage | ✓ | ✓ | — | — |
| templates | templates.read | ✓ | ✓ | ✓ | ✓ |
| templates | templates.manage | ✓ | ✓ | — | — |
| users | users.read / users.manage / users.invite / signups.approve | ✓ | ✓ | — | — |
| settings | settings.read / settings.manage | ✓ | ✓ | — | — |
| audit | audit.read | ✓ | ✓ | — | — |
| roles | roles.manage | ✓ | — | — | — |
| notifications | notifications.read | ✓ | ✓ | ✓ | ✓ |

**Flags:**
- **Referenced-but-not-granted:** none (every `can(...)`/`authorize('...')` key exists in the catalogue).
- **Granted-but-unused (no `can`/`authorize`/nav reference anywhere):** `dashboard.executive` (the Executive view is gated by `role === "ceo"`, **not** this key), `task_comments.read`, `task_updates.read` (their RLS uses task-visibility, not these keys). These are effectively decorative grants.

---

## 5. Role capability matrix

| Capability | admin | section_head | employee | ceo |
|---|:--:|:--:|:--:|:--:|
| View own/assigned tasks | ✓ | ✓ | ✓ | — (read_all) |
| Read **all** tasks | ✓ | ✓ | — | ✓ |
| Create tasks | ✓ | ✓ | ✓ | ✓ (→ pending_approval, unassigned) |
| Edit task fields | ✓ | ✓ | ✓ (own/assigned) | — |
| Approve / reject / return / assign / close / cancel / reopen | ✓ | ✓ | — | — |
| Delete tasks | ✓ | — | — | — |
| Submit for review / log progress / comment / attach | ✓ | ✓ | ✓ | comment+download only |
| Department dashboard | Operational | Operational | Personal | **Executive** (read-only, no drilldown) |
| Weekly/Business-Lines dashboard + Request update | ✓ | ✓ | — | ✓ |
| Workload / Performance pages | ✓ | ✓ | own-scope | **— (revoked)** |
| Reports / Delayed report | ✓ / ✓ | ✓ / ✓ | own / — | all / via read_all |
| Recurring · Projects · Templates · Users · Settings · Audit | all | all (Projects incl.) | — | — |
| Roles management | ✓ | — | — | — |
| CEO request-a-task / request-update | — | — | — | ✓ |

---

## 6. Task lifecycle

**12 statuses** (`task_status` enum): `draft, pending_approval, approved, assigned,
in_progress, pending_update, pending_review, completed, rejected,
returned_for_modification, cancelled, reopened`. **4 priorities:** `low, medium,
high, critical`. **Task number:** `TSS-BC-<year>-<NNNN>` (e.g. `TSS-BC-2026-0001`),
per-year atomic counter via `generate_task_no()` (BEFORE INSERT trigger).

**Allowed transitions** (enforced by `validate_task_transition()`, BEFORE UPDATE OF
status; any other change raises *Illegal task status transition*):
```
draft → pending_approval | assigned | cancelled
pending_approval → approved | rejected | cancelled
approved → assigned | in_progress | pending_review | cancelled
assigned → in_progress | pending_review | cancelled
in_progress → pending_review | pending_update | cancelled
pending_update → in_progress | pending_review | cancelled
pending_review → completed | returned_for_modification | cancelled
returned_for_modification → in_progress | pending_review | cancelled
reopened → in_progress | pending_review | assigned | cancelled
completed → reopened ; cancelled → reopened ; rejected → reopened
```
Side-effects: `approved` stamps `approved_by`; `completed` **requires** non-empty
`closure_summary` + `quality_rating`, sets `progress=100` + `completed_at`;
`cancelled`/`reopened` stamp their timestamps. The `apply_task_update()` AFTER
INSERT trigger mirrors a `task_updates` row's progress into `tasks` and
auto-advances `assigned`/`approved`/`pending_update` → `in_progress`.

**"Dashboard Update" sentinel:** a free-text string literal `'Dashboard Update'`
stored in `tasks.category` (mirrored by `src/lib/dashboard/constants.ts`) — not a
named SQL constant. Drives `request_dashboard_update()`, live-snapshot gating, and
the `dashboard-uploads` storage policy.

---

## 7. Data model

**Enums:** see §6 plus `user_role`, `recurrence_freq` (weekly/monthly/quarterly),
`comment_type_enum` (general/task_specific/ceo_office_comment), `notification_type`
(10 values), `account_status` (pending/active/inactive).

**Tables** (public): `profiles` (1:1 auth.users; role/account_status/is_active),
`departments`, `business_lines` (+`logo_url`), `app_settings`, `permissions`,
`role_permissions`, `task_no_counters`, `tasks` (nullable
business_line_id/assignee_id/start_date/due_date; `task_category` department|project
+ `project_id` with CHECK `tasks_project_link`; `sharepoint_url`; `search_vector`
generated col), `task_updates` (immutable/append-only), `task_comments`,
`task_attachments`, `recurring_tasks` (+`deleted_at` soft-delete), `performance_evaluations`,
`notifications`, `audit_logs` (immutable), `dashboard_snapshots`, `projects`,
`task_templates`. Storage buckets: `task-attachments`, `dashboard-uploads` (both
private). *Every repo table has a migration — `task_templates` IS created by
`20260613160000_task_templates.sql` (not out-of-band in this repo).*

**View:** `daily_employee_workload` (`security_invoker`) — per-employee active-task
aggregation (count, est. hours, utilization, level).

**Functions** (SECURITY DEFINER marked **[D]**, all with `search_path=''`):
`set_updated_at`, `handle_new_user` **[D]** (signup → profile, allow-list, pending),
`authorize(text)` **[D]**, `get_my_permissions()` **[D]**, `generate_task_no()`
**[D]**, `validate_task_transition()` (lifecycle guard), `apply_task_update()`
(progress mirror), `create_notification(...)` **[D]**, `notify_role(...)` **[D]**,
`log_task_status_change()` **[D]**, `generate_due_recurring_tasks()` **[D]**,
`guard_profile_privileges()` **[D]** (blocks privileged self-edits),
`get_latest_live_snapshot()` **[D]** (gated `dashboard.read`),
`request_dashboard_update(uuid)` **[D]**, `get_ceo_department_tasks()` **[D]**
(CEO-only, no assignee identity), `request_task_update(uuid)` **[D]** (CEO own-task
nudge).

**Triggers:** `on_auth_user_created` (auth.users→handle_new_user),
`guard_profile_privileges_trigger`, `set_task_no`, `guard_task_transition`
(BEFORE UPDATE OF status), `audit_task_status_change` (AFTER UPDATE OF status),
`on_task_update_created` (task_updates→tasks progress), and `set_*_updated_at` on
every mutable table.

**RLS (key tables):** `tasks` SELECT = created_by/assignee/`tasks.read_all`; INSERT
= `tasks.create` + self; UPDATE = (creator/assignee or read_all) + `tasks.update`;
DELETE = `tasks.delete`. `task_updates` immutable (insert-only). `projects` /
`templates` / `recurring` SELECT via `*.read`, write via `*.manage`.
`performance_evaluations` SELECT = own or `performance.read_all`. `notifications` =
`user_id = auth.uid()` (no client insert). `dashboard_snapshots` SELECT =
`dashboard.read`; INSERT = uploader + (`dashboard.upload` or the linked Dashboard
Update task's assignee). `audit_logs` SELECT = `audit.read`, no client writes.

---

## 8. Server actions (`src/lib/actions/**`)

| Action | Module | Authorization |
|---|---|---|
| `createTaskAction` / `updateTaskAction` | Tasks | `can("tasks.create")` / `can("tasks.update")` + eligibility |
| `transitionTaskAction` | Tasks | `can(<action's permission>)` (dynamic) + lifecycle guard |
| `requestTaskAction` | Tasks (CEO) | delegates to `createTaskAction` (`tasks.create`) |
| `convertCeoRequestAction` | Approvals | composes update + approve + assign (each re-guarded) |
| `requestTaskUpdateAction` | Tasks (CEO) | `can("tasks.request_update")` → `request_task_update()` |
| `bulkTransitionTasks` | Approvals | per-task via `transitionTaskAction` (no blanket update) |
| `addUpdateAction` / `addCommentAction` / `markAddressedAction` | Task detail | `task_updates.create` / `task_comments.create` / `task_comments.address` |
| `uploadAttachmentAction` / `getAttachmentUrlAction` / `deleteAttachmentAction` | Attachments | `attachments.upload` / `attachments.download` / owner-or-`tasks.delete` |
| `getAssigneeWorkloadAction` | Tasks (create) | `can("tasks.create")`, returns aggregates only |
| `fetchDrilldownTasks` | Dashboard | `getDrilldownScope(role)` (ceo→none, employee→own) |
| `requestDashboardUpdateAction` | Dashboard | `can("dashboard.request_update")` |
| `uploadWeeklyDashboard` | Dashboard | RLS (`dashboard.upload`/assignee) + Zod parse |
| `markNotification*` / `deleteNotifications` | Notifications | RLS `user_id=auth.uid()` |
| `previewMetricsAction` / `create/update/deleteEvaluationAction` | Performance | `can("performance.evaluate")` (preview: read) |
| `createProjectAction` / `setProjectActiveAction` | Projects | `can("projects.manage")` |
| `create/update/setTaskTemplateActiveAction` | Templates | `can("templates.manage")` |
| `create/update/delete/restoreRecurringAction` / `generateNowAction` | Recurring | `can("recurring.manage")` |
| `updateSettingsAction` | Settings | `can("settings.manage")` |
| `inviteUserAction` / `approveSignupAction` / `updateUserAction` | Users | `users.invite` / `signups.approve` / `users.manage` |
| `loadTaskTimeline` | Task detail | RLS-scoped read |

---

## 9. Integrations & flags

- **Supabase** — Auth (email/password + recovery), Postgres 16 (RLS), Storage
  (`task-attachments`, `dashboard-uploads`). Server client = anon key + cookies
  (RLS-subject); a **service-role** client is used only for privileged server
  paths (env `SUPABASE_SERVICE_ROLE_KEY`).
- **Email (Resend)** — `emailEnabled()` (`src/lib/email/send.ts`) = `EMAIL_ENABLED
  === "true"` **AND** `RESEND_API_KEY` **AND** `EMAIL_FROM` set; otherwise every
  send is a silent no-op. Notification fan-out in-app always works (DB functions);
  email is the optional layer. Recipient emails are read via a **service-role**
  admin client (so RLS isn't loosened); service-role is used in exactly three
  places — email recipient lookup, `inviteUserAction`, and the cron route.
  *(In prod, email is generally off — verify the flag.)*
- **Recurring cron** — `GET /api/cron/generate-recurring`, Bearer **`CRON_SECRET`**
  (401 if missing), uses the service-role key (503 if unset) → `generate_due_recurring_tasks()`.
- **Weekly-workbook ingest** — `exceljs` (server-only; `src/lib/dashboard/parse-workbook.ts`
  imports `"server-only"`, invoked only by the `uploadWeeklyDashboard` server
  action) → validated against `dashboardDataSchema` (Zod) → `dashboard_snapshots`.
- **Logo manifest** — `src/lib/dashboard/logo-manifest.json` (committed, generated
  by `scripts/generate-logo-manifest.mjs` in `prebuild`); deterministic slug→file
  resolution; raw `<img>` (not `next/image`).
- **Deploy** — Vercel (project `bc-planner`) + GitHub Actions; a
  `db-push-production` workflow applies new migrations on merge to main.

---

## 10. Recently shipped (reference)

Visible in code (latest first): **work-week capacity fix** (Sun–Thu, 8h/day),
**CEO assignee-workload at create**, **employee personal-dashboard drilldown +
shared `getDrilldownScope`**, **project-metric drilldown**, **section_head projects
management**, **last-progress-update pre-fill**, **workload period filter**,
**weekly-dashboard per-line section trims**, **CEO role refinement** (gained
`tasks.create` + `tasks.request_update`; lost `performance.read_all` +
`workload.read_all`) + **CEO task requests/oversight**, **task templates**, **live
snapshot gating** + **request-update**, **full-text task search + overdue**,
**projects + task↔project link**, **dashboard weekly snapshot** + **account_status
/ signup allow-list**.

---

## 11. Documentation drift found

| Doc | Claim | Reality (code) |
|---|---|---|
| `docs/DATABASE.md` | "**38** total permission keys" + "reconciliation verified" | **47** keys |
| `docs/DATABASE.md` | **employee 15** | **17** |
| `docs/DATABASE.md` | **section_head 35** | **43** |
| `docs/DATABASE.md` | **ceo 10** | **14** |
| `docs/DATABASE.md` | **admin 38** = "all permissions" | **46**; admin lacks `tasks.request_update` (CEO-only) |
| `docs/DATABASE.md` | ceo has "read-all tasks/reports/**workload/performance**" + "**No task authoring**" | ceo **lost** `workload.read_all` + `performance.read_all` (m32) and **gained** `tasks.create` + `tasks.request_update` |
| `README.md` | "`requirePermission()` enforced in the app" | helper exists but **no page calls it**; pages use inline `can()` + `EmptyState` |
| (general) | older docs predate projects/templates/CEO-refinement/work-week migrations | counts above are authoritative as of 34 migrations |

*(Other docs — `PERMISSIONS_AUDIT.md`, `MODULE_*`, `SYSTEM_STATE.md` — should be
reconciled to the §4 catalog; this inventory is the current source of truth.)*

---

## 12. Built vs. pending

| Feature | Status |
|---|---|
| Edit Task dialog (`updateTaskAction`) | **Built** |
| Full-text task search (`search_vector` + filters) | **Built** |
| Delayed-tasks report (`/reports/delayed`) | **Built** |
| Activity timeline (`getTaskTimeline` / `TaskTimeline`) | **Built** |
| Bulk approvals, CEO request/convert, drilldowns, workload period filter, project drilldown, templates, recurring restore | **Built** |
| Email delivery (Resend) | **Built but flag-gated** (`EMAIL_ENABLED` + `RESEND_API_KEY`); off → in-app notifications only |
| **Saved views / saved filters** | **Not built** (no code found) |
| Public-holiday calendar for workload capacity | **Not built** (work-week Sun–Thu only — flagged future refinement) |
| `requirePermission()` redirect usage | **Defined, unused** (pages use inline `can()`) |

---

*Generated as a read-only, code-derived inventory. The only file changed by this
PR is `docs/FEATURE_INVENTORY.md`. No schema/RLS/behavioral change — Gate B N/A.*
