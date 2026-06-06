# Architecture

The architecture, folder structure, and conventions for TSS Planner **as shipped**
(production, 2026-06). For live status see [SYSTEM_STATE.md](./SYSTEM_STATE.md);
for the data model see [DATABASE.md](./DATABASE.md).

## High-level design

TSS Planner is a server-first **Next.js 16 (App Router)** application in
**TypeScript**, styled with **Tailwind CSS v4** + **shadcn/ui (New York)**, backed
by **Supabase** (Postgres + Auth + Storage + RLS), deployed on **Vercel**.

Guiding principles:

- **Server-first.** React Server Components + server actions; minimal client JS.
- **Thin components, layered logic.** UI stays presentational; data access,
  validation, and authorization live in dedicated `lib/*` layers.
- **Type safety end-to-end.** Strict TypeScript + generated Supabase types.
- **Security by default.** Secrets never reach the client; authorization is enforced
  in **both** the database (RLS) and the application layer (permission checks).
- **Clean executive aesthetic.** Minimal, brand-aligned UI.

## Tech stack (shipped)

Next.js **16.2.7** (App Router; middleware via `proxy.ts`), React **19.2.4**,
TypeScript strict (`noUncheckedIndexedAccess`, `noImplicitOverride`), Tailwind CSS
**v4** (CSS `@theme`), shadcn/ui (New York) + lucide-react + sonner, `@supabase/ssr`
**0.10.3** + `supabase-js` **2.107.0**, Zod **4.4.3**, react-hook-form **7.77.0**,
recharts **3.8.0**. Tests: Vitest **4.1.8** (unit), Playwright **1.60.0** (E2E),
pgTAP-style SQL (RLS). Node **≥20 <23**; Supabase CLI **2.105.0** (pinned in CI/CD).

## Folder structure

```
.
├─ .github/workflows/      # ci.yml (lint/typecheck/test/build) + db-push-production.yml (CD)
├─ docs/                   # Architecture, DB, design system, runbooks, roadmap, decisions
├─ public/                 # Static assets
├─ scripts/                # Dev/maintenance scripts (no secrets)
├─ src/
│  ├─ app/
│  │  ├─ (app)/            # Authenticated route group (layout enforces auth)
│  │  │  ├─ layout.tsx     # Session + active-profile gate; loads permissions; app shell
│  │  │  ├─ dashboard/ tasks/ approvals/ performance/ workload/
│  │  │  ├─ reports/ notifications/ recurring/ admin/{users,settings,audit}/
│  │  │  └─ error.tsx      # Friendly error boundary for the whole group
│  │  ├─ login/            # Auth pages
│  │  ├─ api/cron/generate-recurring/  # Secured cron route (Bearer CRON_SECRET)
│  │  ├─ globals.css       # Tailwind import + brand @theme tokens + status tokens
│  │  └─ global-error.tsx  # Root-level error boundary
│  ├─ components/
│  │  ├─ ui/               # shadcn primitives + status-badge, empty-state
│  │  └─ layout/, tasks/, users/, ...  # Feature components
│  ├─ lib/
│  │  ├─ supabase/         # browser / server / proxy client factories (service-role isolated)
│  │  ├─ auth/             # session helpers (getCurrentUser/Profile/Permissions)
│  │  ├─ data/             # the only place issuing queries/mutations
│  │  ├─ actions/          # "use server" actions (permission-gated)
│  │  ├─ permissions/      # can()/authorize helpers (mirror DB RLS)
│  │  ├─ validations/      # Zod schemas
│  │  ├─ email/            # feature-flagged Resend (server-only)
│  │  └─ performance/, reports/  # pure domain helpers (scored, CSV, periods)
│  └─ types/               # generated Supabase types
├─ supabase/
│  ├─ migrations/          # 16 SQL migrations (Supabase CLI)
│  └─ tests/               # rls_test.sql (role-based RLS assertions)
└─ tests/{unit,e2e}/       # Vitest unit + Playwright E2E
```

## Layering & data flow

```
UI (components / app routes / server actions)
        │  calls
        ▼
lib/data  ──uses──▶  lib/supabase (clients)
        │                    │
        ├─ lib/validations    └─ Postgres + RLS
        ├─ lib/permissions
        └─ lib/auth
```

- **`lib/supabase`** — browser, server (RLS-bound, anon key), and proxy clients. The
  service-role client is created only inside server-only modules and is **never**
  imported into client components or prefixed `NEXT_PUBLIC_`.
- **`lib/data`** — the only place that issues queries/mutations.
- **`lib/actions`** — `"use server"` mutations; each gates on a permission
  (`can("…")`) before any write.
- **`lib/permissions` / `lib/auth`** — application-layer authorization that *mirrors*
  database RLS (never replaces it).
- **`lib/validations`** — Zod schemas used at the server boundary.

## Permission model

Role-based, permission-driven:

- Four roles: **admin, ceo, section_head, employee** (`public.user_role` enum on
  `profiles`).
- `permissions` (catalogue) × `role_permissions` (role → permission grants) define
  what each role may do. The DB function **`authorize('permission.key')`** powers RLS
  policies; **`get_my_permissions()`** returns the current user's permission set to
  the app for UI gating.
- Every authenticated page is protected by the `(app)` layout (session + active
  profile). Server actions additionally enforce `can("…")` before writes. RLS on all
  15 tables is the backstop.
- `SECURITY DEFINER` functions (e.g. `generate_task_no`, `create_notification`,
  `handle_new_user`, `authorize`, `get_my_permissions`) all set `search_path = ''`.

## Styling & theming

- **Tailwind v4** CSS-first config. Brand + status tokens declared in
  `src/app/globals.css` under `@theme` / `:root` and consumed via utilities
  (`text-primary`, `bg-primary`, `--color-status-*`).
- Brand: **TSS Burgundy `#762651`** (primary) + **SAPTCO Navy `#193560`** (supporting).
- Design system documented in [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) (shadcn New York,
  240/64px sidebar, mobile Sheet nav, 12 status-badge tokens).

## Typography

- Current UI font is **Inter** (self-hosted via `next/font`). **Frutiger LT Arabic**
  will replace it once official files are supplied — the swap is isolated to
  `layout.tsx` + the `--font-sans` token (and pairs with the Tier 3 RTL work).

## Environment & configuration

- Contract in `.env.example` (placeholders only). Public values are `NEXT_PUBLIC_`;
  everything else is server-only. Key server-only vars: `SUPABASE_SERVICE_ROLE_KEY`,
  `CRON_SECRET`, optional `RESEND_API_KEY`/`EMAIL_FROM`/`EMAIL_ENABLED`.
- The app builds/renders with no env vars set (graceful defaults); features that need
  secrets degrade safely (cron → 503, email → no-op, invites → dashboard fallback).

## Migration & deployment process

- **App:** push/merge to `main` → Vercel builds + deploys to
  `https://bc-planner.vercel.app`.
- **Database:** migrations live in `supabase/migrations/`. On merge to `main`,
  `.github/workflows/db-push-production.yml` runs `supabase link` + `supabase db push`
  against production (`cssxmqwdeiibewucorjx`) using `SUPABASE_ACCESS_TOKEN` +
  `SUPABASE_DB_PASSWORD` repo secrets. The Supabase CLI is **pinned** (`2.105.0`),
  triggers are path-filtered, and concurrency never cancels an in-flight push.
- **Recurring tasks:** `vercel.json` cron hits `GET /api/cron/generate-recurring`
  daily (`0 2 * * *`); the route verifies `Bearer CRON_SECRET` and calls
  `generate_due_recurring_tasks()` via the service-role client.
- **Environments:** production `cssxmqwdeiibewucorjx`, staging `kgfhnskldifoucmpsur`.

## Tooling & quality gates

- **ESLint** (`eslint-config-next` + `eslint-config-prettier`) + **Prettier**
  (`prettier-plugin-tailwindcss`).
- **TypeScript** strict + `noUncheckedIndexedAccess` + `noImplicitOverride`.
- **CI** (`.github/workflows/ci.yml`, Node 20) on PRs and pushes to `main`:
  `lint` → `typecheck` → **`test`** (Vitest) → `build`. E2E (Playwright) runs against
  staging, not in CI.

## Conventions

- Path alias **`@/*`** → `src/*`.
- Components small and presentational; logic in `lib/*`.
- No secrets in source, logs, or output — ever.
- Small, focused commits; update docs alongside code.
