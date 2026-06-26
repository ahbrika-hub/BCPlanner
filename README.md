# TSS Planner

A clean, executive‑grade planning platform for TSS Business Consulting. This
repository is a from‑scratch rebuild; the legacy project is used only as a
**functional** reference.

> **Status:** **Live in production** at **https://bc-planner.vercel.app**. Task
> management, role-based dashboards, analytics, and admin tooling are shipped on
> Supabase (Postgres + Auth + Storage + RLS) with permission-based RBAC. See
> [`docs/SYSTEM_STATE.md`](./docs/SYSTEM_STATE.md) for the authoritative
> current-state record and [`docs/DATABASE.md`](./docs/DATABASE.md) for the data
> layer.

## Stack

- **Next.js 16** (App Router) + **React 19**
- **TypeScript** (strict, with `noUncheckedIndexedAccess` + `noImplicitOverride`)
- **Tailwind CSS v4** (CSS‑first `@theme` tokens) + **shadcn/ui** (New York)
- **ESLint 9** + **Prettier 3** (with `prettier-plugin-tailwindcss`)
- **Supabase** — Postgres 16 + Auth + Storage + **RLS** (RBAC via
  `permissions`/`role_permissions`, enforced by `authorize()` in SQL and
  inline `can()` checks in the app; pages render an `EmptyState`/"access
  restricted" affordance rather than redirecting. A `requirePermission()`
  redirect helper exists but is currently not used by any page.)
- **Zod 4** + **react-hook-form** (validation), **recharts** (charts)
- **Vitest** (unit) + **Playwright** (e2e)
- **Vercel** — hosting (project `bc-planner`, Next.js preset)

## Prerequisites

- **Node.js 20** (see `.nvmrc`; `npm` ships with Node)
- npm 10+

## Setup

```bash
# Use the pinned Node version
nvm use            # reads .nvmrc (Node 20)

# Install dependencies
npm ci

# Copy the env contract (placeholders only — fill real values locally)
cp .env.example .env.local

# Start the dev server
npm run dev        # http://localhost:3000
```

The app builds and runs with **no environment variables set** — unset values
degrade gracefully (e.g. the environment badge defaults to `development`).

## Scripts

| Script                 | Purpose                                |
| ---------------------- | -------------------------------------- |
| `npm run dev`          | Start the local dev server             |
| `npm run build`        | Production build                       |
| `npm run start`        | Serve the production build             |
| `npm run lint`         | ESLint                                 |
| `npm run typecheck`    | `tsc --noEmit` (zero‑error type check) |
| `npm run test`         | Unit tests (Vitest)                    |
| `npm run test:e2e`     | End‑to‑end tests (Playwright)          |
| `npm run types:gen`    | Regenerate Supabase DB types           |
| `npm run format`       | Format the codebase with Prettier      |
| `npm run format:check` | Verify formatting without writing      |

## Environment contract

Defined in [`.env.example`](./.env.example) — **placeholders only, never real
values**. Real values live in `.env.local` (gitignored) and in Vercel project
settings.

| Variable                        | Scope           | Purpose                                  |
| ------------------------------- | --------------- | ---------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Public          | Supabase project URL                     |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public          | Supabase anon key                        |
| `SUPABASE_SERVICE_ROLE_KEY`     | **Server‑only** | Supabase service role key                |
| `NEXT_PUBLIC_APP_ENV`           | Public          | `development` / `staging` / `production` |
| `EMAIL_ENABLED`                 | Server‑only     | Feature flag for transactional email     |
| `RESEND_API_KEY`                | Server‑only     | Transactional email (Resend)             |
| `EMAIL_FROM`                    | Server‑only     | Default From address                     |
| `CRON_SECRET`                   | Server‑only     | Bearer token for the recurring‑task cron |

> Secrets must never appear in source, logs, or commits.
> `SUPABASE_SERVICE_ROLE_KEY` and email credentials are server‑only and must not
> be exposed to the browser.

## Project structure

See [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) for the full folder map and
conventions. Key decisions are recorded in
[`docs/DECISIONS.md`](./docs/DECISIONS.md).

## Branching

All work lands via pull requests into `main`; `main` stays protected and always
deployable (Vercel auto‑deploys on merge, and migration changes auto‑apply via
`.github/workflows/db-push-production.yml`).
