# Decision Record

Confirmed product and platform decisions from **P0**, recorded for continuity.
This is a living document; later phases append new decisions rather than
rewriting history.

> **Security note:** This file records **URLs and non‑sensitive configuration
> only**. API keys, anon/service‑role keys, and any other secrets must **never**
> appear here or anywhere in the repository.

## D1 — Stack & hosting

- **Next.js (App Router) + TypeScript** frontend/backend, **Supabase**
  (Postgres + Auth + RLS) as the backend, deployed on **Vercel**.
- Vercel project: **`bc-planner`** (Next.js preset).

## D2 — Status baseline

- A **12‑status** workflow baseline is adopted for planning items. The concrete
  status set and transitions are defined when the domain model lands (P2+).

## D3 — Business lines

Seven business lines are in scope:

1. **TSS**
2. **Merapp**
3. **ARTC**
4. **Driving School**
5. **Dealership**
6. **Corporate**
7. **General**

## D4 — Department structure

- A **single department: Business Consulting.** The application is scoped to this
  one department for the rebuild.

## D5 — Roles

- **Section Head** — manages their section's planning items.
- **Employee** — works on assigned items.
- **TSS CEO** — **dashboard‑only** (read/overview access; no operational edits).

Role checks are centralized in `src/lib/permissions` and mirrored by database
RLS once Supabase is wired (P2).

## D6 — Data migration

- **No production data migration.** The rebuild starts with a clean database;
  legacy data is not carried over. The old system is a **functional reference
  only**.

## D7 — Email notifications

- Transactional email via **Resend**.
- Notifications fire for **four events** (event list finalized when the workflow
  is implemented). Configured through `EMAIL_PROVIDER_API_KEY` / `EMAIL_FROM`
  (server‑only).

## D8 — Brand

- **TSS‑only**, clean executive SaaS aesthetic.
- **Primary / action — TSS Burgundy `#762651`.**
- **Supporting — SAPTCO Navy `#193560`.**
- No gradients, heavy decoration, or legacy design patterns.
- **Typography:** Frutiger LT Arabic is the target brand font (files not yet
  supplied). **Inter** is the interim font via `next/font`.

## D9 — Supabase environment mapping (URLs only)

Two Supabase projects back the app, mapped by environment. **Only URLs are
recorded here; keys live exclusively in Vercel/`.env.local` and are never
committed.**

| `NEXT_PUBLIC_APP_ENV` | Project ref            | Supabase project URL                     |
| --------------------- | ---------------------- | ---------------------------------------- |
| `staging`             | `kgfhnskldifoucmpsur`  | https://kgfhnskldifoucmpsur.supabase.co  |
| `production`          | `cssxmqwdeiibewucorjx` | https://cssxmqwdeiibewucorjx.supabase.co |

> Filled in during P2 (Supabase wiring). Refs and URLs are **non‑secret**; the
> corresponding anon and service‑role **keys are secrets** and must not be
> stored in the repo. See `docs/SUPABASE.md` for the full wiring.

---

## D10 — Dependency decisions (Data Foundation phase)

- **Zod v4.x** installed this phase. Validation schemas live in
  `src/lib/validations/` and mirror the database model (tasks, task updates,
  profiles). Uses the Zod 4 top-level format validators (`z.uuid()`,
  `z.iso.date()`, `z.url()`).
- **tailwind-merge** must be pinned to **3.x** when shadcn/ui is initialised in
  the Design System phase (compatibility).
- **@tremor/react** is **permanently excluded** (Tailwind v3 / React 18 conflict
  with our Tailwind v4 / React 19 stack).
- **nuqs** — evaluate in a later phase only; the Next.js 16 adapter has an open
  issue (#1263).
- **shadcn/ui** — **adopt** in the Design System phase with the latest CLI for
  the Tailwind v4 `@theme` variant.

## D11 — Database type generation

- Canonical workflow: `npm run types:gen` (Supabase CLI, requires Docker or an
  authenticated CLI). The generated `src/types/database.types.ts` is
  **auto-generated — do not hand-edit**.
- When Docker is unavailable, types can be generated against a plain PostgreSQL
  database using the `@supabase/postgres-meta` engine (the same engine the CLI
  uses). See `docs/DATABASE.md`.

---

## Phase notes

- **P1:** Repository & tooling foundation only — no Supabase, auth, or business
  logic. Committed directly to `main` to establish the deployable baseline;
  subsequent phases use `feat/*` branches + PRs.
- **P2 (Supabase wiring):** clients, session proxy, placeholder types.
- **Data Foundation & Security:** full schema, RLS, seed, generated types, and
  Zod schemas. Database is production-ready after this phase.
