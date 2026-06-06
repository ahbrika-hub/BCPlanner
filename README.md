# TSS Planner

A clean, executive‑grade planning platform for TSS Business Consulting. This
repository is a from‑scratch rebuild; the legacy project is used only as a
**functional** reference.

> **Status:** P1 — Repository & Tooling Foundation. The app builds and deploys,
> but contains no Supabase wiring, authentication, or business logic yet. Those
> arrive in later phases (P2 onward).

## Stack

- **Next.js 16** (App Router) + **React 19**
- **TypeScript** (strict, with `noUncheckedIndexedAccess` + `noImplicitOverride`)
- **Tailwind CSS v4** (CSS‑first `@theme` tokens)
- **ESLint 9** + **Prettier 3** (with `prettier-plugin-tailwindcss`)
- **Supabase** — data/auth backend (wired in P2)
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
| `EMAIL_PROVIDER_API_KEY`        | Server‑only     | Transactional email (Resend)             |
| `EMAIL_FROM`                    | Server‑only     | Default From address                     |

> Secrets must never appear in source, logs, or commits.
> `SUPABASE_SERVICE_ROLE_KEY` and email credentials are server‑only and must not
> be exposed to the browser.

## Project structure

See [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) for the full folder map and
conventions. Key decisions are recorded in
[`docs/DECISIONS.md`](./docs/DECISIONS.md).

## Branching

P1 (this foundation) is committed directly to `main` to establish the baseline
and unblock the first Vercel deploy. **From P2 onward, all work uses `feat/*`
branches and pull requests** — `main` stays protected and always deployable.
