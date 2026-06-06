# P2 — Supabase Client Wiring & Types Workflow — Report

**Repo:** ahbrika-hub/BCPlanner · **Branch:** `feat/p2-supabase-wiring` · **PR:** [#1](https://github.com/ahbrika-hub/BCPlanner/pull/1)
**Date:** 2026-06-06

---

## 1. Summary of work completed

Wired Supabase into the Next.js App Router using the current **`@supabase/ssr`**
pattern (`getAll`/`setAll` cookie API): three typed client files (browser, server,
middleware), root middleware for session refresh, a placeholder `Database` type
with a `types:gen` workflow, Supabase CLI init (`config.toml`), and documentation.
No schema, no auth UI, no business logic, no service-role usage. `lint` /
`typecheck` / `build` pass with no env vars set. Opened PR #1; CI green.

## 2. Files created

- `src/lib/supabase/client.ts` — browser client (`createBrowserClient<Database>`)
- `src/lib/supabase/server.ts` — server client (`createServerClient<Database>`, async `cookies()`)
- `src/lib/supabase/middleware.ts` — `updateSession()` session-refresh helper
- `src/middleware.ts` — root middleware + static-asset-excluding matcher
- `src/types/database.types.ts` — placeholder `Database` type (regenerated in P3)
- `docs/SUPABASE.md` — full wiring documentation
- `supabase/config.toml` — via `supabase init` (`project_id = "bc-planner"`)
- `supabase/.gitignore` — created by `supabase init`

## 3. Files modified

- `package.json` — deps `@supabase/supabase-js`, `@supabase/ssr`, dev `supabase` (CLI); `types:gen` script
- `package-lock.json` — dependency lock
- `docs/DECISIONS.md` — filled D9 staging/production URL + ref mapping (URLs/refs only — no keys)

## 4. Validation results (actual output)

### Versions / CLI

```
@supabase/supabase-js → 2.107.0
@supabase/ssr         → 0.10.3
supabase CLI (devDep) → 2.105.0    (not on PATH; installed locally + via npx)
node                  → v22.22.2
cookie pattern        → getAll/setAll (CookieMethodsServer), verified vs installed types
```

### Lint

```
> bc-planner@0.1.0 lint
> eslint
LINT_EXIT:0
```

### Typecheck

```
> bc-planner@0.1.0 typecheck
> tsc --noEmit
TYPECHECK_EXIT:0
```

### Build (run with no env vars set)

```
▲ Next.js 16.2.7 (Turbopack)
⚠ The "middleware" file convention is deprecated. Please use "proxy" instead.
✓ Compiled successfully in 3.2s
  Finished TypeScript in 2.8s ...
✓ Generating static pages (3/3)
Route (app)
┌ ○ /
└ ○ /_not-found
ƒ Proxy (Middleware)
BUILD_EXIT:0
```

### CI on PR #1 (latest commit `f35d58b`)

```
Lint, Typecheck & Build   → completed / success
Vercel Preview Comments   → success
Vercel deployment         → Ready
```

## 5. Issues or blockers + assumptions

- **Next.js 16.2.x middleware deprecation:** the build warns that the `middleware`
  convention is being renamed to `proxy`. Build passes and `ƒ Proxy (Middleware)`
  is registered. Kept `src/middleware.ts` per the P2 spec; migrating to `proxy.ts`
  is a recommended future follow-up.
- **Async cookies (Next.js 16):** `cookies()` is async — `server.ts` exports an
  `async createClient()` that awaits it. The `setAll` write is wrapped in
  `try/catch` (Server Components can't set cookies; middleware handles refresh).
- **Supabase CLI not on PATH:** installed as a devDependency (2.105.0) so
  `supabase init` and the `types:gen` npm script resolve locally. Docker is
  available, but `supabase start` was intentionally not run (schema is P3).
- **Connection test pending real values:** clients read env lazily and never throw
  at load, so build/typecheck pass with no env vars. Live connection to be verified
  after `.env.local` values are added (Ahmed / Vercel).
- **Service-role key:** not used anywhere in P2; explicitly fenced off from
  `client.ts`/`server.ts`.

## 6. Confirmation checklist

| Item                                          | Status                                        |
| --------------------------------------------- | --------------------------------------------- |
| Branch `feat/p2-supabase-wiring`              | ✅                                            |
| No secrets in any file                        | ✅ (URLs/refs only; secret scan clean)        |
| Three clients compile with `Database` generic | ✅                                            |
| Middleware session refresh present            | ✅ (`updateSession` + matcher)                |
| `types:gen` script added                      | ✅ (env-overridable, defaults to staging ref) |
| PR opened + CI green                          | ✅ PR #1, lint/typecheck/build success        |
| `docs/SUPABASE.md` written                    | ✅                                            |

## 7. Code review (CodeRabbit) — addressed in commit `7045f56`

- **config.toml protocol mismatch** (`https` → `http` redirect) — fixed.
- **middleware `getUser()` unguarded** — wrapped in `try/catch`, still returns the
  response, logs via `console.error`.
- **`types:gen` hardcoded ref** — made overridable via `SUPABASE_PROJECT_ID`,
  defaulting to the staging ref (kept out-of-box behavior rather than fail-fast).

All three confirmed **"✅ Addressed"** by CodeRabbit.

## 8. Recommended next prompt

**P3 — Database schema & migrations.** Define the schema, write SQL migrations
under `supabase/migrations`, apply them, then run `npm run types:gen` to replace
the placeholder `Database` type with generated types. (Merge PR #1 first.)
