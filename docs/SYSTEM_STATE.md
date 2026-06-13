# TSS Planner — System State

**Status:** Live in production · **Audit date:** 2026-06-13 · **Branch of record:** `main`

This is the single source of truth for the *current* state of TSS Planner: what's
deployed, what's delivered, known issues, pending manual steps, the production
URLs, and where to go for onboarding and the roadmap.

> Companion docs: **[ONBOARDING.md](./ONBOARDING.md)** (create/onboard users),
> **[IMPROVEMENT_ROADMAP.md](./IMPROVEMENT_ROADMAP.md)** (Tier 1–4 plan),
> **[GO_LIVE_CHECKLIST.md](./GO_LIVE_CHECKLIST.md)** (runbook),
> **[ARCHITECTURE.md](./ARCHITECTURE.md)** (design), **[DATABASE.md](./DATABASE.md)** (schema).

---

## 1. What it is

Task management + executive dashboard for the **TSS Business Consulting**
department (single department for now). Four roles — **admin, ceo, section_head,
employee** — with permission-based access. Brand: **TSS Burgundy `#762651`** /
**SAPTCO Navy `#193560`**.

## 2. Production environment

| Thing | Value |
|---|---|
| App URL | **https://bc-planner.vercel.app** |
| Vercel project | `bc-planner` (team `tss-s-projects1`, Hobby plan) |
| Supabase production ref | `cssxmqwdeiibewucorjx` |
| Supabase staging ref | `kgfhnskldifoucmpsur` |
| Deploy trigger | push/merge to `main` |
| App deploy | Vercel (auto on push to `main`) |
| DB migration deploy | `.github/workflows/db-push-production.yml` (auto `supabase db push` on migration changes merged to `main`) |

## 3. Tech stack (verified)

Next.js **16.2.7** (App Router, `proxy.ts` middleware), React **19.2.4**,
TypeScript strict (`noUncheckedIndexedAccess`, `noImplicitOverride`), Tailwind
CSS **v4** (CSS `@theme`), shadcn/ui (New York), `@supabase/ssr` **0.10.3** +
`supabase-js` **2.107.0**, Zod **4.4.3**, recharts **3.8.0**, react-hook-form
**7.77.0**, Vitest **4.1.8**, Playwright **1.60.0**. Node **≥20 <23**. Supabase
CLI **2.105.0** (pinned in CI/CD workflows).

## 4. Phases delivered

| Phase | Scope |
|---|---|
| P1 | Repo + tooling foundation (Next, Tailwind v4, ESLint/Prettier, CI, brand tokens, health page) |
| P2 | Supabase client wiring (`@supabase/ssr` browser/server/proxy clients, session refresh) |
| Data foundation | Schema + RLS + reference seed + generated types + Zod |
| P3 | Auth + TSS design system (shadcn New York) + app shell |
| P4 | Core task system (lifecycle state machine, collaboration, approvals, workload, notifications) |
| P5 | Analytics (role dashboards, reports + CSV, performance 40/30/30) |
| Permissions hotfix | `get_my_permissions()` (non-admins were locked out) |
| P6 | Management & config (recurring tasks, user management, settings, audit log) |
| P7 | Launch (prod sync migration, tests + CI, recurring cron, feature-flagged email, security hardening, go-live runbook) |
| Post-launch | Production DB rebuild from an incompatible legacy schema; hosted-safe storage migration; pinned CD; domain fix |
| PR #43 (auth foundation) | CEO `/reports` access (`reports.read` **OR** `reports.read_all`); app-layer authz on `getAttachmentUrlAction` (per-task visibility) + `deleteAttachmentAction` (owner/`tasks.delete`). No RLS relaxed |
| This PR (perf/UX/docs) | `cache()`-wrapped auth helpers + parallel layout fetch; route `loading.tsx` skeletons; docs reconciled to shipped state. Behavior-neutral |

## 5. Database

- **15 public tables**, every one with **RLS enabled**: `profiles`, `departments`,
  `permissions`, `role_permissions`, `business_lines`, `app_settings`, `tasks`,
  `task_updates`, `task_comments`, `task_attachments`, `recurring_tasks`,
  `performance_evaluations`, `notifications`, `audit_logs`, `task_no_counters`.
- **9 `SECURITY DEFINER` functions**, all with `set search_path = ''`.
- RBAC: `permissions` + `role_permissions` resolved via `authorize()` and
  `get_my_permissions()`; reference data ships as an idempotent migration.
- **26 migration files**, including the one-time
  `20260606140000_reset_legacy_public_schema.sql`.

> **Rebuild note (important history):** the production project
> `cssxmqwdeiibewucorjx` was originally initialised with an *incompatible older
> schema* (legacy migrations `0001`–`0006`, a different permission model). That
> caused a post-login 500. It was rebuilt this session: the reset migration drops
> & recreates the `public` schema and the project's migrations rebuild it cleanly.
> The `auth` schema (logins) was **not** touched — see Known Issues #1 for the
> profile side-effect.

## 6. Live status

| Area | Status | Note |
|---|---|---|
| App reachable at production URL | 🟢 | `bc-planner.vercel.app` serves the app; login screen renders |
| Auth (Supabase) | 🟢 | `NEXT_PUBLIC_SUPABASE_*` set in Vercel; sign-in works |
| Production DB schema + seed | 🟢 | All 15 migrations applied + reference data seeded |
| CI (lint/typecheck/test/build) | 🟢 | Green on `main` (Node 20) |
| DB auto-deploy workflow | 🟢 | CLI pinned `2.105.0`, path-filtered, non-cancelling concurrency |
| Recurring cron route | 🟢 (code) / 🟠 (live) | Secured (Bearer `CRON_SECRET`, service-role, fails closed); returns **503 until `CRON_SECRET` + `SUPABASE_SERVICE_ROLE_KEY` set in Vercel** |
| Email notifications | 🟢 (intentionally OFF) | Triple-gated; 4 events wired; enable later |
| Admin profile present | 🟠 | Rebuild wiped `profiles`; first admin must be (re)created — see #1 / ONBOARDING |
| Service-role key rotation | 🔴 | Old keys were exposed; **rotate + set in Vercel** |
| In-app user invites | 🔴 (until key set) | `inviteUserAction` is gated on `SUPABASE_SERVICE_ROLE_KEY` |

## 7. Known issues & gotchas

1. **Profiles are wiped on a schema rebuild (B3).** Dropping `public` deletes all
   `profiles` rows. `auth.users` (logins) survive, but `handle_new_user` only
   creates a profile on *new signup*, so pre-existing users authenticate then hit
   `/login?error=inactive` (the `(app)` layout guard). **Fix now:** run the
   backfill / admin-promote SQL in [ONBOARDING.md](./ONBOARDING.md). **Roadmap:**
   Tier 1 adds an idempotent backfill migration so this never recurs.
2. **"Wrong credentials" when creating a CEO (B1).** The app never creates a
   password-bearing account — there is no create-user-with-password path.
   `inviteUserAction` sends an invite (no password) and is gated on the
   service-role key; "CEO" is a *role*, not an account type. Correct flow:
   create the auth account (Dashboard invite → user sets password), **then**
   promote the role. Full steps in [ONBOARDING.md](./ONBOARDING.md).
3. ~~**A few server actions rely on RLS rather than an explicit app-layer
   gate.**~~ **Closed (PR #43).** `getAttachmentUrlAction` now checks
   `attachments.download` + RLS-scoped per-task visibility before minting a
   signed URL; `deleteAttachmentAction` now enforces uploader-or-`tasks.delete`.
   The notification mark-read/mark-all actions were verified already
   owner-scoped (RLS `notifications_update`/`_delete` + owner-scoped bulk
   actions) and were left unchanged. RLS remains the backstop on all of them.
4. ~~**No loading states.**~~ **Addressed (this PR).** Route-level
   `loading.tsx` skeletons now cover the major `(app)` routes (dashboard, tasks,
   approvals, workload, performance, reports, recurring, notifications, and the
   admin projects/users/settings/audit routes), built from shared brand
   skeleton primitives.
5. ~~**Auth helpers aren't `cache()`-wrapped.**~~ **Fixed (this PR).**
   `getCurrentUser/Profile/Permissions` are wrapped in React `cache()`
   (request-scoped) and the `(app)` layout fetches profile/permissions/unread
   in parallel via `Promise.all`. Return values and gating are unchanged.
6. **`/tasks` status filter is single-select** though the data layer already
   supports arrays (`.in('status', …)`). UI-only fix — Tier 2 (B2).

## 8. Pending manual steps (owner: Ahmed)

1. **Rotate both service-role keys** (staging + production) — old keys were exposed.
2. **Set Vercel env** (Production, server-only, **no** `NEXT_PUBLIC_` prefix):
   `SUPABASE_SERVICE_ROLE_KEY` (rotated prod key), `CRON_SECRET` (random). Confirm
   `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` point at production;
   redeploy.
3. **(Re)create the first admin profile** — see ONBOARDING (the rebuild wiped it).
4. **Onboard** CEO, section heads, employees — see ONBOARDING.
5. **(Optional) enable email** — set `RESEND_API_KEY`, `EMAIL_FROM`,
   `EMAIL_ENABLED=true`.
6. **GitHub Actions secrets** (already set, keep current): `SUPABASE_ACCESS_TOKEN`,
   `SUPABASE_DB_PASSWORD`.

## 9. How to onboard users

See **[ONBOARDING.md](./ONBOARDING.md)** for exact Supabase Dashboard steps per
role, the CEO-login fix, and the profile backfill SQL.

## 10. Improvement roadmap

See **[IMPROVEMENT_ROADMAP.md](./IMPROVEMENT_ROADMAP.md)** for the prioritised
Tier 1–4 plan.

## 11. Known documentation drift (low priority)

- `DECISIONS.md` D7 references `EMAIL_PROVIDER_API_KEY`; the implemented env var is
  `RESEND_API_KEY` (+ `EMAIL_FROM`).
- `MODULE_ADMIN.md` says recurring generation is "planned for Phase 7 — manual
  trigger for now"; the cron route + `vercel.json` schedule now exist.
- `GO_LIVE_CHECKLIST.md` previously said "14 files"; there are now 26 migrations.
- `ARCHITECTURE.md` was P1-era; refreshed in this PR.
