# BCPlanner — UX & Performance Audit (2026-06-14)

**Scope:** read-only audit. No app code, migrations, or dependency changes in this
PR — only this document. Implementation happens later as small, gated, single-surface
PRs (see §6). **Out of scope:** any change to authentication, RLS, permissions, or
role-based access (§5).

**Stack:** Next.js 16 (App Router, RSC + server actions) · React 19 · TS strict ·
Tailwind v4 · shadcn/ui · Recharts · Supabase (PG16, Auth, Storage, RLS).

**Verification caveat:** authenticated paths can't be smoke-tested in the sandbox or
(currently) in Vercel Preview. Findings whose fix changes a rendered authenticated
surface are tagged **needs-authed-prod-verify = yes**.

---

## 1. Executive summary — top 5 wins (impact ÷ effort)

1. **Cap + paginate the unbounded full-page tables** (Reports, Delayed report,
   Approvals queue, Tasks table, CEO tasks). All render 100% of fetched rows and
   their queries carry **no `LIMIT`** (`reports.ts:29`, `delayed.ts:150`,
   `tasks.ts:31`/`:148`). Reports/Approvals are the highest risk (5-table joins,
   per-row client `TaskActionBar`, in-memory CSV). *P1, medium effort, high impact.*
2. **Lazy-load Recharts on the dashboard.** Every chart is a static import in a
   `"use client"` view (`executive-dashboard-view.tsx:17-19`,
   `operational-dashboard-view.tsx:23`, `weekly-dashboard.tsx:12`) with no
   `next/dynamic`/`Suspense`, so Recharts (the largest client dep) ships in the
   dashboard route's initial JS. *P1, low–medium effort, high impact on TTI.*
3. **Add the 5 missing `loading.tsx` skeletons** (`dashboard/weekly`, `tasks/[id]`,
   `reports/delayed`, `projects/[id]`, `admin/templates`). The data-heavy detail
   routes (`tasks/[id]`, `projects/[id]`) have no instant skeleton. *P1, low effort,
   high perceived-perf win.*
4. **Lazy-load the create/edit dialogs** (`new-task-dialog`, `edit-task-dialog`) via
   `next/dynamic`. They + `react-hook-form` are statically imported into the Tasks
   page and ship before any dialog opens (`tasks/page.tsx:17`). *P2, low effort.*
5. **Parallelize the two genuinely-serial page fetches** — `dashboard/page.tsx`
   (profile/permissions/searchParams) and `projects/[id]/page.tsx:40,43`
   (`getProject` + `getProjectHealth`). *P2, low effort.*

> Two commonly-suspected items are **already fixed** and need no work: auth/session
> helpers are React-`cache()`-wrapped (no duplicate round-trips per request), and the
> app layout already `Promise.all`s its independent fetches. See §2 (F-A1, F-A2).

---

## 2. Findings table

Severity: **P0** crash/correctness · **P1** clear, broad perf/UX win · **P2** local
polish. Blast radius = how many surfaces a fix touches.

| ID | Area · file:line | Cat | Sev | Root cause | Recommended fix | Blast radius | Needs migration? | Authed-prod verify? | Effort |
|----|------------------|-----|-----|------------|-----------------|--------------|------------------|---------------------|--------|
| **F1** | Reports table `reports/page.tsx:195`; src `reports.ts:29-75` (no `.limit`/`.range`) | perf | P1 | Date-range report with no filters returns the **entire** tasks table (5-table join), rendered in one `<table>`; CSV built in-memory and passed as client props (`reports/page.tsx:99-122`) | Server-side pagination (`.range()`) + page controls via `useSearchParams` server parsing (nuqs is deferred); stream CSV / cap export | Reports only | No (consider index — see F12) | yes | M |
| **F2** | Delayed report `reports/delayed/page.tsx:191`; `delayed.ts:150-171` | perf | P1 | All non-terminal tasks fetched (no limit) and aggregated in JS (`delayed.ts:86-142`); table renders all rows | Paginate the detail table; keep aggregation server-side; cap CSV | Delayed report only | No | yes | M |
| **F3** | Approvals queue `bulk-queue.tsx:188`; `approvals/page.tsx:57-58` | perf | P1 | Two `BulkQueue`s render every pending task as a Card, each mounting a client `TaskActionBar` (+ `ConvertCeoRequestDialog`) — heavy per-row weight, unbounded | Paginate or "load more" per queue; consider deferring `TaskActionBar` mount | Approvals only | No | yes | M |
| **F4** | Tasks table `tasks-table.tsx:322`; `tasks.ts:31-78` (no limit) | perf | P1 | Renders all rows; 3 `useMemo`s recompute over the full set on every filter/sort (`tasks-table.tsx:154-192`); fat rows (`TASK_SELECT` joins 5 tables) | Server pagination (`.range`) or windowing (no react-window dep today); keep client filters over the page window | Tasks list | No (consider index — F12) | yes | M |
| **F5** | CEO tasks `CeoTasksView` via `tasks/page.tsx:39`; `tasks.ts:148-165` RPC | perf | P2 | `get_ceo_department_tasks()` returns all dept tasks, no limit; rendered whole | Add a row cap/pagination to the RPC + view (note: RPC change = migration) | CEO `/tasks` | **Yes** (if RPC gains a limit arg) | yes | S–M |
| **F6** | Recharts eager bundle: `executive-dashboard-view.tsx:17-19`, `operational-dashboard-view.tsx:23`, `weekly-dashboard.tsx:12` | perf | P1 | Charts statically imported in `"use client"` views; no `next/dynamic`/`Suspense`; Recharts in dashboard initial JS | `next/dynamic(() => import(...), { ssr:false, loading: skeleton })` per chart; or one lazy chart island | Dashboard + weekly | No | yes | S–M |
| **F7** | Missing `loading.tsx`: `dashboard/weekly`, `tasks/[id]`, `reports/delayed`, `projects/[id]`, `admin/templates` | UX | P1 | No route-level Suspense skeleton on these segments; detail routes show blank/stale during fetch | Add `loading.tsx` skeletons mirroring the 12 existing ones | 5 routes | No | yes | S |
| **F8** | Dialogs eager: `tasks/page.tsx:17` (`new-task-dialog`), `edit-task-dialog` usages | perf | P2 | Dialog + `react-hook-form` statically imported into the page, shipped before open | `next/dynamic` the dialogs (client, `ssr:false`); render trigger button eagerly | Tasks + detail | No | yes | S |
| **F9** | `dashboard/page.tsx:30-44` | perf | P2 | `searchParams` / `getCurrentProfile` / `getCurrentPermissions` awaited in series; profile & permissions are independent round-trips | `Promise.all` the independent reads (guard after) | Dashboard | No | yes | S |
| **F10** | `projects/[id]/page.tsx:23-24,40,43` | perf | P2 | `getProject(id)` + `getProjectHealth(id)` are independent but serial; profile/permissions serial via `profile ?` idiom | `Promise.all([getProject,getProjectHealth])` then `notFound()`; batch profile/permissions | Project detail | No | yes | S |
| **F11** | Series `const permissions = profile ? await getCurrentPermissions() : []` across ~11 pages (e.g. `approvals:40-41`, `workload:9-10`, `reports:37-38`) | perf | P2 | Cosmetic serial await; both values are usually `cache()`-hits from the layout, so ~0 real round-trips | Low priority: optionally batch; otherwise leave — measured impact ≈ 0 | Many pages | No | no | S (skip-able) |
| **F12** | `tasks` query filters (status/priority/search/overdue) in `reports.ts`/`tasks.ts` | perf | P2 | If F1/F4 add server pagination over large task volumes, ordering/filtering benefits from an index | **NOTE only** (no migration here): consider an index on `tasks(created_at)` / status — validate with `EXPLAIN` against prod volume first | DB | **Yes (later)** | yes | S |
| **F13** | Logos: `weekly-dashboard.tsx:87`, `brand/tss-logo.tsx:45`; `public/brand/tss-logo.png` (742 KB) + dup `public/business-lines/TSS-logo.png` (742 KB), `merapp.jpg` 355 KB, `driving-school.png` 293 KB, `artc.png` 150 KB | perf | P2 | Full-resolution images via raw `<img>` (bypasses Next optimizer) rendered at ~34–48 px; one logo duplicated | Downscale/compress the logo assets; de-dupe the two 742 KB PNGs; regenerate the manifest. (Raw `<img>` is intentional for the manifest fallback chain — keep it; just shrink files.) | Brand/weekly logos | No | yes (visual) | S |
| **F-A1** | `src/lib/auth/session.ts:17,30,51` | perf | — | **Already fixed** — `getCurrentUser`/`getCurrentProfile`/`getCurrentPermissions` are `cache()`-wrapped; round-trips dedupe per request (regression test `tests/unit/session-cache.test.ts`) | None — candidate (a) **DENIED** | — | No | no | — |
| **F-A2** | `src/app/(app)/layout.tsx:27-31` | perf | — | **Already fixed** — layout `Promise.all`s `getCurrentProfile`/`getCurrentPermissions`/`getUnreadCount` | None — candidate (b) **DENIED** | — | No | no | — |

**Candidate scorecard (from the brief):** (a) cache() — **DENIED, already done**; (b)
layout Promise.all — **DENIED, already done**; (c) missing loading.tsx — **CONFIRMED**
(F7, 5 routes); (d) tables without pagination/virtualization — **CONFIRMED** (F1–F5).

---

## 3. RSC-boundary scan (Server → Client function-prop violations)

**Result: NONE FOUND.** The issue-#29 class of bug — a Server Component passing a
function/component (e.g. a `lucide-react` icon) to a Client Component — does not
currently exist. Every `icon={...}` site and server↔client boundary was traced:

- `dashboard/page.tsx` (server) renders only async server containers
  (`ExecutiveDashboard`/`OperationalDashboard`/`PersonalDashboard`/
  `WeeklyDashboardView`) and passes **only role strings + serializable data** — no
  icons/functions.
- `executive-dashboard-view.tsx:6` and `operational-dashboard-view.tsx:6` are
  **`"use client"`** *specifically* so they can hold lucide icons locally (documented
  in their header comments) and pass them to `KpiCard`/`DrilldownKpi`. Safe.
- `personal-dashboard-view.tsx` is a **Server Component** that imports icons and
  passes them to `KpiCard` (`ui/kpi-card.tsx`, also a Server Component) — **server →
  server**, the icon never crosses the boundary. Safe.
- `ui/kpi-card.tsx` / `charts/kpi-card.tsx` are server-compatible presentational
  components (`import type { LucideIcon }` only), so either a server or client parent
  may pass an icon. Safe.
- `WeeklyDashboardView` (server) → `WeeklyDashboard` (`"use client"`) passes only
  `data` + a serializable `logoSrc` string map. No function props. Safe.

The known-safe pattern documented in the code is being followed consistently. **No
fix required**; keep the pattern in mind when adding new server→client dashboard
props.

---

## 4. Bundle / dependency notes

- **`exceljs` is server-only and unreachable from the client — confirmed.** The only
  `src` import is `src/lib/dashboard/parse-workbook.ts:3`, and that file's first line
  is `import "server-only";` (`parse-workbook.ts:1`); its only caller is the server
  action `src/lib/actions/dashboard.ts` (`"use server"`). Other references are
  non-shipping (`tests/unit/dashboard-parser.test.ts`, `scripts/`). No `"use client"`
  file imports it. CSV export uses a lightweight local `@/lib/reports/csv` `toCsv`,
  **not** exceljs.
- **Recharts is confined to client chart components** (`charts/*`,
  `dashboard/weekly/weekly-chart.tsx`, the `ui/chart.tsx` wrapper) — all `"use
  client"`. No server component imports it. Its only weakness is eager bundling on the
  dashboard route (F6), not leakage.
- **No heavy date/util libs** — grep for `date-fns|moment|lodash|dayjs` returns
  nothing; formatting is local (`@/lib/format`).
- **No `page.tsx`/`layout.tsx` is `"use client"`** (only the Next-required
  `error.tsx`/`global-error.tsx`). 68 `"use client"` files total; the largest are
  genuinely-interactive views (`weekly-dashboard.tsx` 601 lines, `recurring-manager`
  532, `users-manager` 393, `bulk-queue` 373, `tasks-table` 369). No boundary defects;
  the lazy-load opportunity is the charts inside them (F6), not the islands themselves.
- **Client imports of `@/lib/data/*` are all `import type`** (type-only, erased) — zero
  runtime/bundle weight. `src/lib/data/types.ts` is pure `import type`.
- **Assets (raw `<img>`, not `next/image`)** — see **F13**. Two **742 KB** PNGs ship
  full-resolution (`public/brand/tss-logo.png` and the duplicate
  `public/business-lines/TSS-logo.png`), plus `merapp.jpg` 355 KB / `driving-school.png`
  293 KB / `artc.png` 150 KB, all rendered at ~34–48 px. The logo **manifest is
  committed as the source of truth** (`src/lib/dashboard/logo-manifest.json`, generated
  in `prebuild`) — good; the issue is image weight, not resolution logic.

---

## 5. Out of scope / intentionally not touched

- **Auth / RLS / permissions / role-based access** — not touched as a "performance"
  measure (security-sensitive; a CEO-visibility PR just merged). The `tasks.read_all`
  scoping, `authorize()`/`can()`, and the SECURITY DEFINER read functions stay as-is.
- **Client data-cache layer (`@tanstack/react-query`)** — intentionally deferred. This
  is server-first (RSC reads, server-action writes); no general client cache is
  recommended. Optimistic UI is only suggested locally where a write is a single
  server action with a trivially-known next state (e.g. notification mark-read,
  request-update button) — not a blanket pattern.
- **`nuqs`** — deferred (Next 16 adapter issue). URL/filter state recommendations use
  `useSearchParams` + server parsing (the app already does this via
  `parseStatusParam`), **not** nuqs.
- **`tailwind-merge`** stays 3.x; **`@tremor/react`** excluded. No dependency changes.
- **Virtualization libraries** (react-window/react-virtual) — not adding a dep now;
  prefer server pagination first (F1–F4). Revisit windowing only if a single page
  window is still too large after pagination.

---

## 6. Recommended implementation sequence (small, gated PRs)

Each is one coherent, independently reviewable/revertible change. Default gate
(**Gate A**): `npm run lint` · `typecheck` · `test` · `build` green; changed files
scoped to the surface. **Gate B** only where DB/RPC behavior changes. Most need an
**authenticated prod check** to verify the rendered surface (sandbox/Preview can't).

1. **`feat/loading-skeletons`** (F7) — add the 5 missing `loading.tsx`. Gate A; authed
   prod check that each route shows a skeleton. *Lowest risk, ship first.*
2. **`perf/dashboard-lazy-charts`** (F6) — `next/dynamic` the dashboard/weekly charts
   with skeleton fallbacks; RSC-boundary safe (charts already client). Gate A + bundle
   diff (dashboard initial JS shrinks); authed prod check the dashboard renders.
3. **`perf/parallel-page-fetches`** (F9, F10) — `Promise.all` the independent reads on
   `dashboard` and `projects/[id]`. Gate A; authed prod check both pages.
4. **`feat/reports-pagination`** (F1) — server `.range()` + page controls
   (`useSearchParams`) + capped/streamed CSV. Gate A; authed prod check large range.
5. **`feat/delayed-report-pagination`** (F2) — paginate the detail table, aggregation
   stays server-side. Gate A; authed prod check.
6. **`feat/approvals-pagination`** (F3) — "load more"/paginate each queue; consider
   deferring per-row `TaskActionBar`. Gate A; authed prod check the queue + bulk flow.
7. **`feat/tasks-pagination`** (F4) — server pagination for the Tasks table; keep
   client filters over the page window. Gate A; authed prod check filters/sort.
8. **`perf/lazy-task-dialogs`** (F8) — `next/dynamic` new/edit dialogs. Gate A + bundle
   diff; authed prod check open/submit.
9. **`feat/ceo-tasks-pagination`** (F5) — cap/paginate `get_ceo_department_tasks()` and
   `CeoTasksView`. **Gate B** (RPC change → migration + PG16 proof) + Gate A; authed
   prod check as CEO.
10. **`perf/optimize-logo-assets`** (F13) — downscale/compress the logo PNGs/JPG,
    de-dupe the two 742 KB files, regenerate the manifest. Gate A + manifest check;
    authed prod visual check the logos still render. *Low risk, asset-only.*
11. **`perf/tasks-index` (NOTE/optional, F12)** — only if F1/F4 prod metrics show slow
    ordering at volume: add an index after `EXPLAIN`. Gate B (migration).

> F11 (series profile/permissions awaits) is intentionally **not** scheduled — it's a
> cache-served no-op; scheduling it would be churn without measurable benefit.

---

*Prepared as a read-only audit. No behavior changed in this PR.*
