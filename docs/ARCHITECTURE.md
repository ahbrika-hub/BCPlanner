# Architecture

This document describes the agreed architecture, folder structure, and
conventions for TSS Planner. It reflects the **P1 foundation**; sections marked
_(later)_ describe where future phases plug in.

## High‑level design

TSS Planner is a server‑first **Next.js (App Router)** application written in
**TypeScript**, styled with **Tailwind CSS v4**, and backed by **Supabase**
(Postgres + Auth + RLS) _(wired in P2)_. It is deployed on **Vercel**.

Guiding principles:

- **Server‑first.** Prefer React Server Components and server actions; ship the
  minimum client JavaScript.
- **Thin components, layered logic.** UI components stay presentational; data
  access, validation, and authorization live in dedicated `lib/*` layers.
- **Type safety end‑to‑end.** Strict TypeScript plus generated Supabase types.
- **Security by default.** Secrets never reach the client; authorization is
  enforced in both the database (RLS) and the application layer.
- **Clean executive aesthetic.** Minimal, brand‑aligned UI — no gradients, heavy
  decoration, or legacy design patterns.

## Folder structure

```
.
├─ .github/workflows/      # CI (lint, typecheck, build)
├─ docs/                   # Architecture & decision records
├─ public/                 # Static assets
├─ scripts/                # Dev/maintenance scripts (no secrets)
├─ src/
│  ├─ app/                 # App Router: routes, layouts, pages
│  │  ├─ layout.tsx        # Root layout (fonts, <html>/<body>)
│  │  ├─ page.tsx          # Branded health page
│  │  └─ globals.css       # Tailwind import + brand @theme tokens
│  ├─ components/
│  │  ├─ ui/               # Presentational primitives (design system, P6)
│  │  └─ layout/           # Shells, headers, navigation
│  ├─ hooks/               # Reusable React client hooks
│  ├─ lib/
│  │  ├─ supabase/         # Supabase client factories (P2)
│  │  ├─ data/             # Data‑access functions (queries/mutations)
│  │  ├─ permissions/      # Role / access‑control logic
│  │  ├─ validations/      # Schema validation (e.g. Zod)
│  │  └─ utils/            # Pure helpers
│  └─ types/               # Shared & generated DB types
├─ supabase/
│  ├─ migrations/          # SQL migrations (Supabase CLI)
│  └─ tests/               # DB tests (e.g. pgTAP for RLS)
└─ tests/e2e/              # Playwright E2E tests (runner added in P15)
```

## Layering & data flow _(later)_

```
UI (components / app routes)
        │  calls
        ▼
lib/data  ──uses──▶  lib/supabase (clients)
        │                    │
        ├─ lib/validations   └─ Postgres + RLS
        └─ lib/permissions
```

- **`lib/supabase`** — creates browser and server Supabase clients. The
  server‑only service‑role client is isolated here and never imported into
  client components.
- **`lib/data`** — the only place that issues queries/mutations. Components and
  routes call these functions rather than touching Supabase directly.
- **`lib/permissions`** — centralizes role checks (Section Head, Employee, TSS
  CEO). Mirrors, never replaces, database RLS.
- **`lib/validations`** — shared input schemas used at client and server
  boundaries.

## Styling & theming

- **Tailwind CSS v4** with CSS‑first configuration. Brand tokens are declared in
  `src/app/globals.css` under `@theme` (e.g. `--color-brand-primary`,
  `--color-brand-secondary`, the gray scale, and semantic state colors), exposed
  as utilities like `text-brand-primary` / `bg-success`.
- Brand: **TSS Burgundy `#762651`** (primary/action) and **SAPTCO Navy
  `#193560`** (supporting).
- The full design system (components, spacing, elevation) is **P6**.

## Typography

- Interim UI font is **Inter**, loaded and self‑hosted via `next/font`
  (no font files committed), with a professional system fallback stack.
- **Frutiger LT Arabic** will replace Inter once official font files are
  supplied. The swap is isolated to `layout.tsx` + the `--font-sans` token.

## Environment & configuration

- The environment contract lives in `.env.example` (placeholders only). See the
  README for the variable table.
- Public values are prefixed `NEXT_PUBLIC_`; everything else is server‑only.
- The app must build and render with **no env vars set** — code defaults
  gracefully (e.g. `NEXT_PUBLIC_APP_ENV` → `development`).

## Tooling & quality gates

- **ESLint** (`eslint-config-next` + `eslint-config-prettier`) and **Prettier**
  (`prettier-plugin-tailwindcss`).
- **TypeScript** strict mode plus `noUncheckedIndexedAccess` and
  `noImplicitOverride`.
- **CI** (`.github/workflows/ci.yml`) runs on PRs and pushes to `main` using
  Node 20: `lint`, `typecheck`, `build`. The test step is added in **P15**.

## Conventions

- Path alias **`@/*`** maps to `src/*`.
- Keep components small and presentational; push logic into `lib/*`.
- No secrets in source, logs, or output — ever.
- Small, focused commits; update docs alongside code.
