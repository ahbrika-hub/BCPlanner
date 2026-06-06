# Supabase Integration

How Supabase is wired into TSS Planner using the current `@supabase/ssr`
App Router pattern. This phase (P2) wires **clients and session refresh only** —
there is no schema, auth UI, or business logic yet.

> **Security:** No keys appear in this repo. Project **URLs and refs are
> non‑secret** and are documented below. The **anon key**, and especially the
> **service‑role key**, are secrets that live only in `.env.local` (local) and
> Vercel environment variables.

## Packages

| Package                 | Version | Purpose                                |
| ----------------------- | ------- | -------------------------------------- |
| `@supabase/supabase-js` | 2.107.0 | Core Supabase JS client                |
| `@supabase/ssr`         | 0.10.3  | App Router cookie‑based SSR helpers    |
| `supabase` (dev)        | 2.105.0 | CLI: `init`, local stack, type codegen |

The `@supabase/ssr` cookie contract uses the current **`getAll` / `setAll`**
methods (not the deprecated `get` / `set` / `remove` API).

## The three client files

| File                             | Runtime     | Use in                                                |
| -------------------------------- | ----------- | ----------------------------------------------------- |
| `src/lib/supabase/client.ts`     | Browser     | **Client Components only**                            |
| `src/lib/supabase/server.ts`     | Server      | **Server Components, Server Actions, Route Handlers** |
| `src/lib/supabase/middleware.ts` | Edge/Server | Session refresh helper, called by root middleware     |

### `client.ts` — browser

```ts
import { createClient } from "@/lib/supabase/client";

const supabase = createClient(); // safe to call per render/use
```

- Built with `createBrowserClient<Database>`.
- Reads `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Returns a fresh client per call (no module‑level singleton), avoiding any
  cross‑request shared state. Never throws at module load.

### `server.ts` — server

```ts
import { createClient } from "@/lib/supabase/server";

export default async function Page() {
  const supabase = await createClient(); // async: cookies() is awaited
  // ...
}
```

- Built with `createServerClient<Database>` and Next.js `cookies()`.
- **`cookies()` is async in Next.js 16** — the factory is `async` and awaits it.
- Uses the **anon key under RLS**. The `setAll` write is wrapped in `try/catch`
  because Server Components cannot set cookies; middleware handles the refresh.

> **`SUPABASE_SERVICE_ROLE_KEY` must never be used in `server.ts`** (or anywhere
> client‑reachable). It is **not needed in P2 at all**. When a privileged
> server‑only operation eventually requires it, it will be isolated in its own
> clearly‑named server module — never in these files and never in `client.ts`.

### `middleware.ts` (helper) + root `src/middleware.ts`

- `updateSession(request)` creates a server client bound to request/response
  cookies, calls `supabase.auth.getUser()` to refresh the session, and returns
  the `NextResponse`.
- The root `src/middleware.ts` calls `updateSession` and exports a `config.matcher`
  that runs on all paths **except** `_next/static`, `_next/image`, `favicon.ico`,
  and static image assets (`svg`, `png`, `jpg`, `jpeg`, `gif`, `webp`, `ico`).
- **No route protection yet** — that is added in P5.

## Environment setup

The app builds and runs with **no env vars set** (clients read env lazily and do
not throw at load). To actually connect to Supabase, provide real values.

### Local development

1. Copy the contract: `cp .env.example .env.local`
2. Fill in the **two public values** for the target project:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Find these under **Supabase Dashboard → Project Settings → API**.
   `.env.local` is gitignored — **never paste keys into docs, code, or commits.**

`SUPABASE_SERVICE_ROLE_KEY` is **not required** for P2 and should be left as a
placeholder.

### Vercel

Set the same `NEXT_PUBLIC_*` variables in the Vercel project (`bc-planner`)
environment settings, scoped per environment (Preview/Production) as needed.

## Project URL / ref mapping (non‑secret)

| Environment | Project ref            | Project URL                              |
| ----------- | ---------------------- | ---------------------------------------- |
| Staging     | `kgfhnskldifoucmpsur`  | https://kgfhnskldifoucmpsur.supabase.co  |
| Production  | `cssxmqwdeiibewucorjx` | https://cssxmqwdeiibewucorjx.supabase.co |

Refs and URLs are safe to commit. Keys are not.

## Database types workflow

`src/types/database.types.ts` is currently a **placeholder**:

```ts
export type Database = Record<string, unknown>;
```

This lets all three clients compile with the `<Database>` generic today. After
the P3 schema migrations are applied, regenerate the real types:

```bash
npm run types:gen
```

which runs:

```bash
supabase gen types typescript --project-id kgfhnskldifoucmpsur > src/types/database.types.ts
```

**Requires an authenticated Supabase CLI** — either `supabase login` or a
`SUPABASE_ACCESS_TOKEN` in the environment. The generated file is auto‑generated;
do **not** hand‑edit it.

## Local Supabase stack (optional)

The Supabase CLI is installed as a dev dependency and `supabase init` has created
`supabase/config.toml`. When **Docker is available**, you can run a full local
stack:

```bash
npx supabase start   # starts local Postgres, Auth, Studio, etc.
npx supabase stop
```

P2 does **not** start the stack or apply migrations — schema work is P3. The
Vercel‑hosted staging/production projects are the validation target for P2/P3.
