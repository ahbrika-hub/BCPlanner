# TSS Planner — Improvement Roadmap

Prioritised plan derived from the system audit (2026-06-06). Effort key:
**S** ≈ ≤1 day · **M** ≈ 2–4 days · **L** ≈ 1–2 weeks · **XL** ≈ 3+ weeks.

Tiers 1–2 include full detail (impact, effort, dependencies/risks, standalone-PR
viability). Tiers 3–4 are scoped at a planning level.

---

## TIER 1 — Critical / Immediate (within ~2 weeks of go-live)

### T1.1 — Rotate service-role keys + set Vercel env *(ops, not a PR)*
- **Why it matters:** the old service-role keys were exposed; an unrotated key is a
  full bypass of RLS. Until `SUPABASE_SERVICE_ROLE_KEY` + `CRON_SECRET` are set, the
  recurring cron returns 503 and in-app invites are disabled.
- **Effort:** S.
- **Dependencies / risks:** Supabase + Vercel dashboard access. After rotating,
  update Vercel env and redeploy; verify cron + invites.
- **Standalone PR?** No — operational (dashboards), no code change.

### T1.2 — Profile backfill migration (fixes B3 permanently)
- **Why it matters:** a schema rebuild wipes `profiles` while `auth.users` survive,
  locking every existing user out (`/login?error=inactive`). This already happened
  in production.
- **What:** add an idempotent migration that inserts an `employee` profile for any
  `auth.users` row missing one (`left join ... where p.id is null ... on conflict do nothing`).
- **Effort:** S.
- **Dependencies / risks:** none; idempotent and safe to re-run. Does not re-promote
  roles (intentional — promotion stays explicit).
- **Standalone PR?** Yes — a single migration file.

### T1.3 — Onboarding runbook + CEO-login fix *(this PR)*
- **Why it matters:** the "CEO wrong credentials" issue blocks onboarding the most
  important user. Root cause: no password-bearing account is created.
- **What:** documented in [ONBOARDING.md](./ONBOARDING.md) — create auth account
  (with password) → promote role.
- **Effort:** S (docs). **Standalone PR?** Yes (docs-only — delivered here).

### T1.4 — Close server-action authorization gaps
- **Why it matters:** defense-in-depth. Three write/read actions lean entirely on
  RLS today:
  - `getAttachmentUrlAction` — mints a signed URL for any storage `path` with **no
    auth/task-membership check**; add an auth check + verify the caller can access
    the task.
  - `deleteAttachmentAction` — authenticated but **no `can(...)` gate**; add the
    `attachments.delete`/`tasks.delete` permission check.
  - `markNotificationReadAction` / `markAllNotificationsReadAction` — no app-layer
    check; **confirm the `notifications` RLS policy strictly scopes rows to
    `user_id = auth.uid()`** (it does today) and add a light guard for clarity.
- **Effort:** S–M.
- **Dependencies / risks:** low; add a focused RLS test for notifications + storage.
- **Standalone PR?** Yes.

### T1.5 — Wrap auth helpers in React `cache()`
- **Why it matters:** `getCurrentUser/Profile/Permissions` are called by the layout
  **and** each page, and `getCurrentProfile` re-calls `getCurrentUser`. Every
  navigation fires `auth.getUser()` and the `get_my_permissions` RPC multiple times
  — extra latency and DB load on the hottest path.
- **What:** wrap the three helpers in `cache()` to dedupe within a render pass;
  optionally `Promise.all` the independent awaits in the layout.
- **Effort:** S.
- **Dependencies / risks:** none; pure win. Verify no stale-cache assumptions.
- **Standalone PR?** Yes.

> Tier 1 also includes the **one-time ops items** already actioned/queued: re-create
> the first admin profile (ONBOARDING §1) and confirm production click-through
> (GO_LIVE_CHECKLIST §2).

---

## TIER 2 — High value / Near-term (1–2 months)

### T2.1 — Real-time notifications (Supabase Realtime)
- **Why:** the bell badge currently updates only on navigation. A live subscription
  on the `notifications` table makes updates instant — a visible quality jump for an
  executive tool.
- **Effort:** M.
- **Dependencies / risks:** enable Realtime on `notifications`; a client subscription
  hook respecting RLS; handle reconnection. Low risk (additive).
- **Standalone PR?** Yes.

### T2.2 — Turn on email notifications (Resend)
- **Why:** four events are already wired (`task_assigned`, `pending_approval`,
  `pending_review`, `completed`) but `EMAIL_ENABLED=false`. Email closes the loop for
  users not actively in the app.
- **Effort:** S (mostly config + verification).
- **Dependencies / risks:** Resend account + verified sender domain; set
  `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_ENABLED=true`; the service-role key (T1.1)
  for recipient resolution. Risk: sender-domain reputation/deliverability.
- **Standalone PR?** Yes (code exists; PR is the enablement + tests/templates polish).

### T2.3 — In-app user invites
- **Why:** lets admins invite from `/admin/users` instead of the Supabase Dashboard —
  smoother onboarding. Code exists (`inviteUserAction`).
- **Effort:** S.
- **Dependencies / risks:** **blocked on T1.1** (`SUPABASE_SERVICE_ROLE_KEY`).
  Invitee still sets their own password via the email link.
- **Standalone PR?** Yes (or pure config once the key is set).

### T2.4 — `/tasks` status multi-select filter (B2)
- **Why:** users frequently want "show pending_approval + assigned + in_progress."
  The data layer already supports it (`status?: TaskStatus[]` → `.in('status', …)`).
- **Effort:** S.
- **Dependencies / risks:** UI-only — swap the single `Select` for a multi-select
  popover and parse the array/CSV in `tasks/page.tsx`. No DB change.
- **Standalone PR?** Yes.

### T2.5 — Loading states / skeletons
- **Why:** there are no `loading.tsx`/Suspense states; navigation blocks on the
  server fetch with no feedback. The `skeleton` component is installed but unused.
- **Effort:** M.
- **Dependencies / risks:** add `loading.tsx` (or Suspense skeletons) per route;
  low risk. Pairs well with T1.5.
- **Standalone PR?** Yes.

### T2.6 — PDF export for reports
- **Why:** executives want a shareable PDF alongside the existing CSV export.
- **Effort:** M.
- **Dependencies / risks:** a PDF approach (server-side render or print-stylesheet →
  PDF). Watch bundle size / serverless limits; brand the layout.
- **Standalone PR?** Yes.

### T2.7 — Inline attachment preview (PDF/image viewer)
- **Why:** users open attachments constantly; an inline viewer beats a download
  round-trip. Signed-URL plumbing already exists.
- **Effort:** M.
- **Dependencies / risks:** image/PDF viewer component; reuse `createSignedUrl`;
  honour the existing access checks (and T1.4 gate). MIME-type handling.
- **Standalone PR?** Yes.

### T2.8 — Bulk task actions (approve/assign multiple)
- **Why:** section heads process queues; one-at-a-time is slow. Bulk approve/assign
  is a real time-saver in `/approvals` and `/tasks`.
- **Effort:** M–L.
- **Dependencies / risks:** multi-select UI + a batched server action that re-checks
  permissions and the transition guard per task (don't bypass `validate_task_transition`).
  Partial-failure UX.
- **Standalone PR?** Yes.

### T2.9 — Full-text task search (tsvector)
- **Why:** current filtering is field-based; users want to search title/description.
- **Effort:** M.
- **Dependencies / risks:** a `tsvector` column + GIN index migration + a search
  input; keep RLS intact. Arabic tokenisation is a later concern (Tier 3 RTL).
- **Standalone PR?** Yes.

### T2.10 — Per-role dashboard widget customisation
- **Why:** admin/ceo/section_head/employee care about different KPIs; configurable
  widgets raise daily usefulness.
- **Effort:** L.
- **Dependencies / risks:** a layout/preferences model (per-user or per-role) and a
  widget registry; scope creep risk — start with show/hide of existing widgets.
- **Standalone PR?** Yes (phase it).

---

## TIER 3 — Strategic / Medium-term (3–6 months)

- **Arabic (RTL) localisation** + **Frutiger LT Arabic** font (the swap is isolated
  to `layout.tsx` + `--font-sans`); full `dir="rtl"`, i18n strings, mirrored layout.
- **Custom domain** (e.g. `tss-planner.saptco.com`) with DNS + Vercel domain config.
- **Task dependencies / blocking relationships** (graph model + cycle prevention).
- **Calendar / Gantt timeline view** for tasks (by due date / assignee).
- **Mobile PWA** (installable, offline shell, home-screen shortcut).
- **Custom task fields per business line** (schema for dynamic attributes).
- **Advanced analytics** — trend forecasting, SLA tracking, bottleneck detection.
- **Automated performance evaluations** — scheduled auto-compute + save (cron, reuses
  the 40/30/30 formula).
- **External integrations** — Microsoft Teams notifications, SharePoint, Power BI export.
- **Error monitoring** — Sentry (or equivalent) for client/server exceptions.
- **Performance monitoring** — Core Web Vitals dashboard.

## TIER 4 — Future vision / Long-term

- **Native mobile app** (iOS / Android).
- **AI-assisted task planning** — suggest priorities, flag overdue patterns, draft
  summaries.
- **Multi-department expansion** — beyond "Business Consulting" to all TSS departments
  (department scoping already exists in the model).
- **Role expansion** — guest/external collaborator; a department-head tier above
  `section_head`.
- **Public API** for third-party integrations.
- **White-label / multi-tenant** for other SAPTCO subsidiaries.

---

## Suggested sequencing

1. **T1.1 → T1.2 → T1.4 → T1.5** (security + stability), with T1.3 (docs) done.
2. **T2.4, T2.5, T2.2/T2.3** (cheap, high-visibility wins).
3. **T2.1, T2.7, T2.6** (engagement + executive polish).
4. Re-evaluate Tier 3 against real usage data after 1–2 months live.
