# BCPlanner (TSS Planner) — Full Codebase + Product Review

**Date:** 2026-06-09 · **Reviewer:** Staff engineering + product audit (read-only) · **Branch base:** `main` @ PR #38 merged

> **Scope & method.** Static review: reading source + migrations/RLS, `typecheck`/`lint`/`build` signals, and two structured sub-audits (RSC boundary + actions/data). **The sandbox cannot run the authenticated app** (no Supabase API gateway/env), so SSR/runtime/role-specific behaviour is reasoned from code, not executed — every such conclusion is marked **VERIFIED-static / runtime-unconfirmed**. Findings are grounded in real files (paths cited) and separated into **VERIFIED** vs **HYPOTHESIS**. This builds on the existing `docs/` (IMPROVEMENT_ROADMAP, SYSTEM_STATE, PERMISSIONS_AUDIT); items already tracked there are marked **[tracked]**.

---

## 1. Executive summary

BCPlanner is a **well-architected, security-conscious** RBAC workflow app. The fundamentals are strong: every table has RLS enabled with default-deny; all `SECURITY DEFINER` functions set `search_path = ''`; `authorize()` reads role from `profiles` (not JWT) and checks `is_active`; the service-role key is server-only and permission-gated; there is a real DB-level task-transition guard and self-escalation guard; the data/action/validation patterns are consistent; and `typecheck`/`lint`/`build` are green. The team has clearly internalised its past incidents (RLS circular dependency, stale-JWT, per-env UUIDs, the server→client function-prop crash — **all confirmed fixed**).

The remaining risk is concentrated in a few places: **authorization enforced only at the app layer for things the DB also lets through** (status-transition *permissions*, and cross-profile reads), a **role-specific data-visibility gap that the admin-only sandbox can't surface** (CEO/employee see blank names; CEO's workload shows only themselves), and **process gaps** (Playwright exists but isn't in CI; no lint rule for the crash class that bit twice). None are an open door for outsiders — RLS is fail-closed — but several let an *authenticated insider* sidestep workflow controls or degrade the executive experience.

### Top 5 to address
1. **Enforce per-transition permissions at the DB** (or block direct `tasks` writes) — today a creator/assignee can self-approve/self-complete their own task via PostgREST. *(High; new)*
2. **Fix cross-profile visibility for read-all roles** — CEO/employee can't read other `profiles`, so names blank out org-wide and the CEO's `daily_employee_workload` returns only their own row. *(High; new manifestation)*
3. **Close the authenticated-UI/SSR test blind spot** — wire Playwright e2e into CI against the Vercel preview + add an ESLint rule for server→client function props. This is the root cause of the two prod regressions. *(High; new)*
4. **Finish the tracked app-layer authz gaps** — `getAttachmentUrlAction`, `deleteAttachmentAction`, notification mutators. *(Med; [tracked] T1.4 — still open)*
5. **Rotate the exposed service-role keys + set Vercel env.** *(Critical-ops; [tracked] SYSTEM_STATE §8 — still pending)*

---

## 2. Findings by severity

### CRITICAL

**C1 — Exposed service-role keys not rotated.** *Security/Ops · env (not in repo) · [tracked] SYSTEM_STATE §8 / roadmap T1.1.*
The service-role key was historically exposed and is **pending rotation**; the bypasses-RLS key must be rotated and set server-only in Vercel (`SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`). **Risk:** full data access if the old key leaked. **Fix:** rotate in Supabase, set Vercel envs, redeploy. **Effort:** S (ops). *Code itself is correct — keys are read from env, never hardcoded; this is an operational action.*

### HIGH

**H1 — DB enforces transition *legality* but not transition *permissions* → segregation-of-duties bypass.** *Security/Correctness · `supabase/migrations/20260606141711_rls_policies.sql` (tasks_update) + `20260606141054_tasks_core.sql` (`validate_task_transition`) · VERIFIED-static.*
`tasks_update` RLS only requires `(created_by OR assignee) AND tasks.update` (or `read_all AND tasks.update`). `validate_task_transition()` checks the status *graph* and requires `closure_summary`+`quality_rating` for `completed`, but **does not check per-action permissions** (`tasks.approve`, `tasks.close`, `tasks.return`, `tasks.assign`) — those live only in `transitionTaskAction` (`src/lib/actions/tasks.ts`). **Impact:** an authenticated creator/assignee with `tasks.update` (every employee, on their own tasks) can PATCH `status` directly via PostgREST to drive their own task through legal transitions the app reserves for managers — e.g. `pending_approval→approved` (**self-approve**) or `pending_review→completed` (**self-complete**, supplying their own rating). Defeats the approval/review control for one's own work. **Fix:** add a `SECURITY DEFINER` permission check inside `validate_task_transition` keyed on the target status (mirror `ACTIONS` in `src/lib/tasks/transitions.ts`), or restrict client `tasks` UPDATE to non-status columns and route all status changes through a `SECURITY DEFINER` RPC. **Effort:** M.

**H2 — `profiles_select` + read-all roles lacking `users.read` → blank names and an empty CEO workload.** *Security(under-exposure)/Correctness/UX · `rls_policies.sql` (profiles_select), `20260606171529_reference_data_seed.sql` (grants), `20260606141057_workload_view.sql` · VERIFIED-static / runtime-unconfirmed.*
`profiles_select = auth.uid() = id OR authorize('users.read')`. `users.read` is granted only to **section_head + admin** — **not ceo, not employee**. Yet the app embeds other users' profiles everywhere (`assignee/creator/approver:profiles(...)` in `TASK_SELECT`/`REPORT_SELECT`/`OVERVIEW_SELECT`; comment `author`; eval `employee`). PostgREST returns an unreadable embedded relation as **`null`**, and the `as unknown as …WithRelations` casts hide it (confirmed by the actions/data audit, point 7). **Impact:** for **CEO** (the executive oversight role, `tasks.read_all`/`reports.read_all`/`performance.read_all`) and **employees viewing others' data**, names render as "—" across tasks, reports, and the team-performance table. Worse: `daily_employee_workload` is `security_invoker = true` and selects `from profiles p`, so for CEO it returns **only their own row** — `/workload` shows the CEO just themselves, not the team. This is the textbook "works for admin in the sandbox, breaks for other roles in prod" class. **Fix:** add a narrow profiles read path for oversight roles — broaden `profiles_select` to also allow when `authorize('tasks.read_all')` (or a new `profiles.read_basic`), or expose `(id, full_name)` via a `SECURITY DEFINER` directory function/view. **Effort:** M.

**H3 — Authenticated-UI / SSR test blind spot (root cause of two prod regressions).** *Testing/CI · `.github/workflows/ci.yml`, `package.json`, `tests/e2e/` · VERIFIED.*
`ci.yml` runs `lint`, `typecheck`, `npm run test` (vitest unit) and `build` — but **not** `test:e2e`. Playwright is installed and a single `tests/e2e/auth.spec.ts` exists; nothing exercises authenticated pages, so SSR/RSC/role bugs pass `typecheck`+`build` and reach prod (the #28 server→client function prop; the #27 empty-snapshot crash). **Fix (layered):** (a) ESLint rule / `eslint-plugin-react-server-components` (or a custom rule) to flag function/component props passed from server components to `"use client"` components; (b) Playwright e2e in CI against the Vercel **preview** deployment with seeded logins for each of the 4 roles, smoke-testing every authed route; (c) at minimum, a build-time authed-render smoke for the two `force-dynamic` dashboard routes. **Effort:** M–L.

### MEDIUM

**M1 — Tracked app-layer authorization gaps still open.** *Security · `src/lib/actions/collaboration.ts`, `notifications.ts` · [tracked] roadmap T1.4 / SYSTEM_STATE §7.3 · VERIFIED.*
- `getAttachmentUrlAction` (`collaboration.ts:145`) — mints a signed Storage URL for a `path` with **no task-membership check** (RLS on `task_attachments` rows ≠ a guard on the signed-URL mint). Highest of this group.
- `deleteAttachmentAction` (`collaboration.ts:158`) — authenticated, **no `can(...)`** (RLS `task_attachments_delete` = `uploaded_by OR tasks.delete` saves it).
- `markNotificationReadAction` / `markAllNotificationsReadAction` (`notifications.ts:25,76`) — no app-layer auth/owner scope; `markAllRead` updates all `is_read=false` **without a `user_id` filter** (only `notifications_update` RLS `user_id = auth.uid()` saves it). **Fix:** add explicit `can(...)`/ownership checks + a notifications/storage RLS test. **Effort:** S–M.

**M2 — CEO cannot open `/reports` (guard checks `reports.read`, CEO holds `reports.read_all`).** *Correctness/Product · `src/app/(app)/reports/page.tsx:36` · [tracked] PERMISSIONS_AUDIT M1 · VERIFIED.*
`/workload` and `/performance` accept `read || read_all`; `/reports` checks only `reports.read`, which CEO lacks → blocked despite the role model granting org-wide reports. **Fix:** `can("reports.read") || can("reports.read_all")`. **Effort:** S.

**M3 — Unbounded list queries + full-table-scan aggregation in JS.** *Performance · `src/lib/data/{tasks,reports,analytics,notifications}.ts` · VERIFIED.*
No `.limit()`/pagination on `listTasks`, `getReportData`, `listNotifications`, `listUsers`, `listEvaluations`, `listProjects`, `listRecurringTasks`, `getWorkload`; `getDashboardStats`/`getStatusDistribution`/`getTasksByBusinessLine` pull the **whole `tasks` table** and aggregate in JS each render. Only `listAuditLogs` paginates. Fine at current volume; degrades linearly. **Fix:** server-side aggregation (SQL `count(*) … group by`) for dashboard stats; pagination/virtualised tables for `/tasks`, `/notifications`, `/reports`. **Effort:** M.

**M4 — Raw DB/RLS error strings leak to the client.** *Security(info-disclosure)/UX · all actions via `errMessage()` + data-layer `throw new Error(error.message)` · VERIFIED.*
Every `{ok:false,error}` can surface the raw Postgres/RLS message (e.g. `tasks.ts:51,74`). **Fix:** map known errors to friendly copy; log the raw message server-side, return a generic message client-side. **Effort:** S.

**M5 — `transitionTaskAction` payload (and `addCommentAction` text) not Zod-validated.** *Correctness · `actions/tasks.ts:113`, `actions/collaboration.ts:56` · VERIFIED.*
`payload.quality_rating`/`assignee_id`/`closure_summary` flow to the DB with manual checks only; `quality_rating` range relies on the table CHECK (`between 1 and 5` — present, good) but `addCommentAction` text has no length bound. **Fix:** add Zod schemas (a `transitionPayloadSchema`, reuse a comment schema). **Effort:** S.

**M6 — `performance_evaluations` has no `unique(employee_id, period)`; app upsert is non-atomic.** *Data integrity · `actions/performance.ts` (idempotent lookup-then-write) · [tracked, proposed-unapplied] · VERIFIED.*
PR #33 made saves idempotent in the app, but two concurrent first-time saves can both miss the existing row → duplicate (TOCTOU). **Fix:** one-off de-dupe migration + `unique(employee_id, period)` (or partial unique) — already proposed; verify it won't reject legitimate re-evaluations (it won't, since re-eval updates in place). **Effort:** S–M.

### LOW

**L1 — Resilience: only `/dashboard` has `loading.tsx`; `(auth)`/`/unauthorized`/root-layout errors fall through to the bare `global-error.tsx`.** `(app)/error.tsx` covers all `(app)` routes. *[tracked] SYSTEM_STATE §7.4.* **Fix:** add `loading.tsx` skeletons + an `(auth)` error boundary. **Effort:** S.

**L2 — Auth helpers not wrapped in React `cache()`.** `getCurrentUser/Profile/Permissions` run multiple times per request (layout + page; `getCurrentProfile` re-calls `getCurrentUser`). *[tracked] roadmap T1.5.* **Fix:** `cache()` the three helpers; `Promise.all` independent awaits in the layout. **Effort:** S.

**L3 — `updateSettingsAction` issues N sequential `UPDATE`s in a loop** (`actions/settings.ts:29`). **Fix:** `Promise.all`/single upsert. **Effort:** S.

**L4 — Minor consistency:** `setProjectActiveSchema` defined but unused (`projects.ts:46` passes a bare boolean); `previewMetricsAction`/`getAttachmentUrlAction`/`uploadWeeklyDashboard` use ad-hoc result shapes instead of `ActionResult`; pervasive `as unknown as …WithRelations` casts (necessary for PostgREST embeds, but they mask the H2 null-join issue). **Effort:** S.

**L5 — `recurring_tasks` `expected_end_date ≥ start_date` enforced only in Zod, not the DB** (unlike tasks' `tasks_project_link` CHECK). Low risk (single write path). **Effort:** S.

---

## 3. Security summary

**Per-table RLS status (VERIFIED from `rls_policies.sql` + later migrations):**

| Table | RLS | SELECT | INSERT | UPDATE | DELETE | Notes |
|---|---|---|---|---|---|---|
| profiles | ✅ | self OR `users.read` | trigger only | self OR `users.manage` (+escalation guard) | service-role | **H2** under-exposure |
| departments / business_lines / app_settings / permissions | ✅ | active user / gated | — | `*.manage` | — | OK |
| role_permissions | ✅ | `roles.manage` | `roles.manage` | — | — | read-via `get_my_permissions` SECDEF |
| tasks | ✅ | owner/assignee/`read_all` | `tasks.create` ∧ self | owner/assignee ∧ `tasks.update` | `tasks.delete` | **H1** no per-transition perm |
| task_updates | ✅ | task-member | `task_updates.create` ∧ assignee/read_all | — (immutable) | — | good |
| task_comments | ✅ | task-member | author ∧ task-member | `task_comments.address` | — | good |
| task_attachments | ✅ | `download` ∧ task-member | `upload` ∧ self ∧ task-member | — | `uploaded_by` OR `tasks.delete` | **M1** signed-URL mint |
| recurring_tasks | ✅ | `recurring.manage` | (FOR ALL) | (FOR ALL) | (soft-delete UPDATE) | good |
| performance_evaluations | ✅ | self OR `read_all` | `evaluate` | `evaluate` | `evaluate` ∧ `users.manage` | **M6** no unique |
| notifications | ✅ | `user_id=uid` | service/trigger | `user_id=uid` | owner (PR #25) | **M1** app-layer scope |
| audit_logs | ✅ | `audit.read` | none (trigger/service) | none | none | append-only, good |
| dashboard_snapshots | ✅ | `dashboard.read` | `dashboard.upload` OR task-assignee ∧ `uploaded_by=uid` | — | — | good |
| projects | ✅ | `projects.read` | `projects.manage` | `projects.manage` | `projects.manage` | good (PR #36) |
| task_no_counters | ✅ | **no client policy** (SECDEF only) | — | — | — | correct lockdown |
| storage.objects (dashboard-uploads) | ✅ | `dashboard.read` | `upload`/`read` | — | — | platform-dependent (noted in migration) |

**SECURITY DEFINER functions:** `authorize`, `get_my_permissions`, `handle_new_user`, `guard_profile_privileges`, `generate_task_no`, `notify_role`, `create_notification`, `generate_due_recurring_tasks` — **all set `search_path = ''`** (VERIFIED). `authorize` is `STABLE`, checks `is_active`, derives role from `profiles`. `generate_due_recurring_tasks` is granted to `service_role`/`authenticated` only and correctly skips soft-deleted templates via `is_active=false`. **No issues found.**

**Service-role usage (VERIFIED server-only):** `src/app/api/cron/generate-recurring/route.ts` (Bearer `CRON_SECRET`, fails closed 401/503), `src/lib/actions/users.ts` `inviteUserAction` (gated on `users.invite`), `src/lib/email/events.ts` (resolve recipient emails). None client-reachable; `src/lib/supabase/server.ts` is anon-key only and documents the prohibition. **No secrets in code or this document.**

**Auth/session:** `getCurrentProfile` reads `profiles` (not JWT claims) — the stale-JWT lesson applied. `handle_new_user` forces `employee`, sets self-signups `pending`+inactive, and enforces email-domain allow-list gated on `session_user='supabase_auth_admin'`. `guard_profile_privileges` blocks self-changes to role/department/active/status unless `users.manage`. Strong.

---

## 4. Known-issue status check (from the task CONTEXT)

| Known item | Status | Evidence |
|---|---|---|
| RLS circular dependency (fixed via SECURITY DEFINER) | ✅ **Confirmed fixed** | `authorize()`/`get_my_permissions()` are SECDEF; RLS reads them without recursion |
| Stale JWT roles (read profiles, not JWT) | ✅ **Confirmed fixed** | `getCurrentProfile` + `authorize` read `profiles.role` |
| Per-env UUID pitfalls (key off slugs) | ✅ **Confirmed** | logo/business-line resolution keys off slugs (`/business-lines/<id>`); sample data keys off slugs |
| Server→client function-prop crash | ✅ **Confirmed fixed; class clean** | dashboard views now `"use client"`; sub-audit found **no** remaining server→client function props. *Gap: no lint rule prevents recurrence (H3).* |
| Unguarded empty-state data crash | ✅ **Confirmed fixed** | `weekly-dashboard.tsx` guards `businessLines[0]` via `?.`/`{bl && …}`; charts render `EmptyState` |
| Exposed service-role keys not rotated | 🔴 **Still open** | SYSTEM_STATE §8 pending; **C1** |
| No standalone Edit Task form | 🟠 **Confirmed open** | only `new-task-dialog.tsx`; `updateTaskAction`/`updateTaskSchema` exist but unused by UI → `sharepoint_url`/`task_category`/`project_id` set only at creation |
| Proposed-unapplied `unique(employee_id, period)` | 🟠 **Confirmed open** | **M6** |

---

## 5. Feature roadmap

> Complements the existing `IMPROVEMENT_ROADMAP.md` (Tiers 1–4). New/sharpened items below; **[tracked]** = already in that doc.

### Quick wins (S–M)
- **Edit Task dialog** — reuse the task form + `updateTaskAction`, gated to creator/assignee/admin/section_head; lets existing tasks change SharePoint link, Task Category/Project, assignee, dates. *Highest user-visible gap; the create-only form leaves new fields un-editable.* **M.**
- **`/tasks` status multi-select filter** — data layer already supports `.in('status', …)`; UI-only. *[tracked T2.4]* **S.**
- **CEO/oversight fixes bundle** — H2 + M2 together: cross-profile names + `/reports` guard. *Unblocks the executive experience.* **M.**
- **Loading skeletons** for the slow server-fetch routes. *[tracked T2.5]* **S–M.**
- **Surface project + task category** on the `/tasks` list and `/reports` (filters/columns) now that the data exists. **S–M.**

### High-value (M)
- **Real-time notifications** (Supabase Realtime) + the **bell unread-count** live-updating. *[tracked T2.1]* **M.**
- **Email notifications on** (Resend) — code paths exist (`lib/email/events.ts`), needs env + enablement + a digest option. *[tracked T2.2]* **M.**
- **Bulk task actions** (approve/assign multiple) mirroring notifications bulk UX. *[tracked T2.8]* **M.**
- **PDF export for reports** + scheduled report email. *[tracked T2.6]* **M.**
- **Full-text task search** (`tsvector`) replacing `ilike`. *[tracked T2.9]* **M.**
- **Recurring auto-generation** — wire the cron route to a Vercel Cron (it's built and fails-closed; just needs `CRON_SECRET` + schedule), retiring the manual "Generate Due Tasks Now". **S (ops) + verify.**

### Strategic (L)
- **Project workspaces** — now that `projects` + `task.project_id` exist, add a project detail page (tasks, members, progress, SharePoint), project-level reporting, and project status. *Turns the reference table into a module.* **L.**
- **Approval delegation & SLAs** — escalation/timeouts on `pending_approval`/`pending_review` (ties to H1's permission model). **L.**
- **Audit-log UI filters + retention** and **observability** (Sentry/Logflare) for the SSR errors that currently only surface as opaque digests. **M–L.**
- **Capacity planning** built on `daily_employee_workload` (after H2) — forecasts, reassignment suggestions. **L.**

---

## 6. Recommended sequencing

1. **Ops first (today):** rotate keys + set Vercel env (**C1**) — unblocks email/cron and closes the biggest exposure. Pure ops, no code.
2. **Close the test blind spot (H3)** *before* more feature work — add the ESLint server→client-prop rule + Playwright-in-CI against the preview. This is the cheapest insurance against the recurring prod-crash class and makes everything after it safer to ship from a sandbox that can't run authed.
3. **Role-correctness bundle (H2 + M2):** cross-profile read path + `/reports` guard — the executive views are currently broken for the most important user, and the sandbox can't see it.
4. **Authorization hardening (H1 + M1):** per-transition permission enforcement at the DB + the tracked app-layer authz gaps. Ship with the RLS/transition tests from step 2.
5. **Quick UX wins:** Edit Task dialog, status multi-select, loading skeletons, project columns.
6. **Then** the High-value features (realtime, email, bulk, search) and performance hardening (M3) as volume grows.

Rationale: ops + the test harness are *force multipliers* (they de-risk every later change); the role-correctness and authorization items are the genuinely user- and security-impacting bugs the current toolchain can't catch; features follow once the floor is safe.

---

## 7. Coverage note

**Fully reviewed:** all 24 migrations (schema, every RLS policy, all `SECURITY DEFINER` functions, triggers, the workload view, the transition guard); auth/session + both Supabase clients + middleware location; the cron route + all service-role call sites; permission/role-permission seed + `authorize`/`get_my_permissions`; CI workflows + `package.json` test setup; the RSC server→client boundary across all `src/**` (sub-audit); every server action's auth/authz/Zod/error shape + the data layer's pagination/N+1/cast patterns (sub-audit); the existing `docs/` roadmap/state/permissions-audit (dedup).

**Lighter / not exhaustively read:** the full component tree's a11y and mobile responsiveness (spot-checked: semantic Radix/shadcn primitives, `aria-*` on nav/dialogs, sticky-column tables — looks solid, but no axe/runtime pass was possible); the design-system tokens; per-component visual states. **Not executable:** anything runtime/role-specific (authed SSR, actual RLS-null name rendering, the CEO workload row count) — these are reasoned from code and marked runtime-unconfirmed; **they are exactly what H3's e2e harness would verify.**

**Honesty caveat:** because the sandbox can't run the authenticated app, the two highest-confidence-but-unexecuted findings (H1 exploit path via PostgREST, H2 blank-names/empty-workload) are logically derived from the RLS + grants + guard SQL; they should be confirmed with a quick authed test as the first use of the H3 harness.
