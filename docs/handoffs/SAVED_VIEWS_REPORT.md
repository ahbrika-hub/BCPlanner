# Saved Views — Completion Report

Personal **Saved Views** for the Tasks list: save the current filter/sort
combination under a name, pin it in the sidebar under the Tasks/Work group, apply
it in one click, and rename / update / delete it. Personal-only (no sharing).

---

## 1. Branch

**`claude/feat-saved-views-3mka55`** — branched off `main`, checked out, and pushed
to origin as the first action of this work; no source file was touched until it
existed.

> Note on naming: the task body asked for a branch literally named `feat/saved-views`.
> The harness governance for this session designates `claude/feat-saved-views-3mka55`
> as the development branch and forbids pushing to any other branch without explicit
> permission. That branch already existed and was checked out, so (with the user's
> go-ahead) all work and the PR use it. This is the only deviation from the brief.

Feature branch → PR to `main`. `main` is never pushed to directly. `main` stays
deployable after this PR (additive migration + additive code only).

---

## 2. Summary of what was built

- A `public.saved_views` table (owner-scoped RLS, no permission key) that stores a
  **JSON snapshot of the existing `/tasks` URL filter/sort state**.
- A shared, framework-agnostic config module that round-trips that snapshot through
  the **same** URL params the task list already reads — there is no parallel
  filtering path.
- Zod validation (strict — unknown keys rejected) used at the server-action layer.
- Server actions (create / rename / update-config / delete) gated by an
  authenticated-session check + owner-scoped RLS.
- UI on the Tasks page: a **Save view** control (shadcn dialog + react-hook-form +
  Zod + Sonner). When a view is applied it becomes a menu offering Update / Rename /
  Save-as-new / Delete.
- Sidebar: the caller's saved views render as indented sub-links under the Tasks
  item, each linking to `/tasks` with the view's stored query string. Empty list ⇒
  nothing extra renders.

---

## 3. Files changed / added

### Migration
| File | Change |
|------|--------|
| `supabase/migrations/20260626120000_saved_views.sql` | **New.** `public.saved_views` table; `(user_id)` index; `set_updated_at` trigger (reused); RLS enabled; four owner-scoped policies `to authenticated` using `(select auth.uid())`. No permission seed. |

### Types
| File | Change |
|------|--------|
| `src/types/database.types.ts` | Hand-added `saved_views` Row/Insert/Update + FK relationship (the generated-types file can't be regenerated against prod from here; the data layer needs `Tables["saved_views"]`). |

### Validation
| File | Change |
|------|--------|
| `src/lib/tasks/saved-view-config.ts` | **New.** `savedViewConfigSchema` (`.strict()`); `configToQueryString()` / `searchParamsToConfig()` serializers — the single source of truth for the config↔URL mapping, usable on client and server. |
| `src/lib/validations/saved-views.ts` | **New.** `createSavedViewSchema`, `renameSavedViewSchema`, `updateSavedViewConfigSchema` (name 1–80 trimmed; config delegates to the config schema). |
| `src/lib/validations/index.ts` | Re-export `./saved-views`. |

### Data layer
| File | Change |
|------|--------|
| `src/lib/data/saved-views.ts` | **New.** `listSavedViews`, `createSavedView`, `updateSavedView`, `deleteSavedView` (`server-only`; owner scoping enforced by RLS). Exports `SavedView` (config narrowed to `SavedViewConfig`). |

### Server actions
| File | Change |
|------|--------|
| `src/lib/actions/saved-views.ts` | **New.** `createSavedViewAction`, `renameSavedViewAction`, `updateSavedViewConfigAction`, `deleteSavedViewAction`. Each: Zod `safeParse` first, `getCurrentUser()` auth check, RLS for ownership, `revalidatePath("/tasks")`. Reuses the `ActionResult` convention. No service-role, no permission key. |

### UI
| File | Change |
|------|--------|
| `src/components/tasks/saved-view-controls.tsx` | **New** client component. Reads current URL → config; Save / Update / Rename / Delete via dialogs + Sonner. |
| `src/app/(app)/tasks/page.tsx` | Render `<SavedViewControls />` in the header actions (non-CEO branch). Existing filtering untouched. |

### Nav / sidebar
| File | Change |
|------|--------|
| `src/components/providers/session-provider.tsx` | Add `savedViews: SavedView[]` to `SessionValue`. |
| `src/app/(app)/layout.tsx` | Add `listSavedViews()` to the existing `Promise.all`; pass into the provider. |
| `src/components/layout/app-nav.tsx` | Render saved views as indented sub-links under the Tasks item (expanded sidebar only), gated by the Tasks item's existing `canSeeNavItem` result. |

### Tests / report
| File | Change |
|------|--------|
| `tests/unit/saved-view-config.test.ts` | **New.** Zod accept/reject + config↔URL round-trip. |
| `docs/handoffs/SAVED_VIEWS_REPORT.md` | **New.** This report. |

---

## 4. The exact task-list URL param contract matched

The saved-view config mirrors the existing `/tasks` URL state verbatim (source:
`src/app/(app)/tasks/page.tsx`, `src/components/tasks/task-filters.tsx`,
`src/components/tasks/tasks-table.tsx`, `src/lib/tasks/status.ts`). No new format.

| URL param | Value format | Applied | Config key |
|-----------|--------------|---------|------------|
| `q` | free-text string | server (`listTasks` search) | `q` |
| `status` | comma-separated `TaskStatus` tokens, de-duped, invalid dropped | server | `status: string[]` |
| `priority` | `low` \| `medium` \| `high` \| `critical` (`all` ⇒ param deleted) | server | `priority` |
| `overdue` | literal `"1"` = on; absent/other = off | server | `overdue: boolean` |
| `assignee` | assignee UUID (`all` ⇒ deleted) | client (History API) | `assignee` |
| `business_line` | business-line UUID (`all` ⇒ deleted) | client | `business_line` |
| `sort` | `<col>.<dir>`, col ∈ {task_no,title,status,priority,assignee,due_date}, dir ∈ {asc,desc} | client | `sort` |

No URL-state library (`nuqs` etc.) — plain `URLSearchParams` + `router.push`
(server filters) / `history.replaceState` (client filters). Convention: empty / `all`
⇒ delete the param; bare `/tasks` when nothing is set. Applying a saved view writes
these same params (plus a non-filter `view=<id>` marker used only to detect which
view is currently applied); the marker is never stored in a config and `.strict()`
would reject it if it were.

---

## 5. Gate A — actual output

### `npm run lint`
```
> bc-planner@0.1.0 lint
> eslint

```
Exit 0.

### `npm run typecheck`
```
> bc-planner@0.1.0 typecheck
> tsc --noEmit

```
Exit 0.

### `npm run test`
```
 RUN  v4.1.8 /home/user/BCPlanner

 Test Files  38 passed (38)
      Tests  176 passed (176)
   Duration  3.55s
```
Exit 0.

Focused new test (verbose) — Zod accept/reject + round-trip:
```
 ✓ savedViewConfigSchema > accepts a representative valid config
 ✓ savedViewConfigSchema > accepts an empty config
 ✓ savedViewConfigSchema > rejects an unknown key
 ✓ savedViewConfigSchema > rejects a malformed sort value
 ✓ savedViewConfigSchema > rejects a non-uuid assignee and an invalid status
 ✓ savedViewConfigSchema > rejects an invalid priority
 ✓ config <-> query string round-trip > serializes a config to the existing URL param formats
 ✓ config <-> query string round-trip > round-trips through searchParamsToConfig unchanged
 ✓ config <-> query string round-trip > ignores unknown params (e.g. `view`) and `all` sentinels on read
 ✓ config <-> query string round-trip > empty / invalid config serializes to an empty query string

 Test Files  1 passed (1)
      Tests  10 passed (10)
```

### `npm run build`
```
> bc-planner@0.1.0 build
> next build
  ...
  Running TypeScript ...
  Finished TypeScript in 9.5s ...
✓ Generating static pages using 3 workers (22/22) in 421ms
  Finalizing page optimization ...

Route (app)
├ ƒ /tasks
└ ƒ /tasks/[id]
...
```
Exit 0.

### Dependencies
`git diff --stat package.json package-lock.json` → **no changes**. `tailwind-merge`
stays `^3.6.0`. No new dependencies: the feature uses only existing deps (`zod`,
`react-hook-form`, `@hookform/resolvers`, `sonner`, `radix-ui`, `lucide-react`).

---

## 6. Gate B — real PG16 behavioral proof

A throwaway PostgreSQL **16.13** cluster was `initdb`'d locally; prod-only roles
(`anon`/`authenticated`/`service_role`) and an `auth` schema (`auth.users` +
`auth.uid()` reading `request.jwt.claims->>'sub'`) plus `storage` shims were created
with `CREATE … IF NOT EXISTS` (per project convention), then **all 35 migrations**
were applied in order, ending with the new `20260626120000_saved_views.sql`.

```
### initdb (PostgreSQL 16)
PostgreSQL 16.13 (Ubuntu 16.13-0ubuntu0.24.04.1) on x86_64-pc-linux-gnu ...
### Apply ALL migrations in order
  applied 20260606140000_reset_legacy_public_schema.sql
  ... (33 more) ...
  applied 20260626120000_saved_views.sql
all migrations applied
```

### Table + policies present
```
   relname   | rls_enabled
-------------+-------------
 saved_views | t

      polname       | polcmd
--------------------+--------
 saved_views_delete | d
 saved_views_insert | a
 saved_views_select | r
 saved_views_update | w
```

### Proof 1 — RLS isolation (before / after)

**As user A — insert a view:**
```
                  id                  |               user_id                |      name
--------------------------------------+--------------------------------------+----------------
 47b704b3-9600-4ba5-9301-ab925504b4d4 | aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa | A overdue high
INSERT 0 1
```

**As user B — SELECT (expect 0):**
```
 b_sees_rows
-------------
           0
```

**As user B — UPDATE then DELETE A's view (expect 0 rows affected each):**
```
UPDATE 0
DELETE 0
```

**As user A — SELECT own views (expect 1, unchanged):**
```
 a_sees_rows
-------------
           1

      name
----------------
 A overdue high
```

B cannot see, modify, or delete A's view; A's view is intact → owner isolation
holds.

### Proof 2 — config jsonb round-trip
A representative config was inserted and read back, then compared byte-for-byte to
the original:
```
config: {"q": "report", "sort": "due_date.asc", "status": ["in_progress", "completed"],
         "overdue": true, "assignee": "11111111-1111-4111-8111-111111111111",
         "priority": "high", "business_line": "22222222-2222-4222-9222-222222222222"}

 config_roundtrips_unchanged
-----------------------------
 t
```

### Proof 3 — Zod accept/reject
Covered by the unit test in Gate A: the strict schema **accepts** a valid config and
**rejects** unknown keys, malformed `sort`, non-UUID `assignee`, invalid `status`,
and invalid `priority` (10/10 passing).

---

## 7. Assumptions & decisions

- **Owner-scoped RLS instead of `authorize()` — intentional, no new permission key.**
  Reference tables in this project (e.g. `projects`) gate access with a permission
  key checked by `public.authorize()` in RLS and `can(...)` in the action. Saved
  views are **private per-user data**, so the row owner *is* the authorization. The
  policies compare `user_id = (select auth.uid())` and the actions only assert an
  authenticated session; ownership is never trusted from the client (INSERT sets
  `user_id` to the session user; UPDATE/DELETE simply affect 0 rows for non-owners,
  as proven in Gate B). This matches the brief's explicit allowance and avoids
  inventing a permission key for data that has no cross-user visibility.
- **`(select auth.uid())`** is used (rather than bare `auth.uid()` as in some older
  tables) so the planner evaluates it once per statement — the Supabase RLS
  performance pattern — with `user_id` indexed.
- **Applied-view detection via a `view=<id>` URL param.** It is not a filter (the
  page ignores it) and is never written into a config, so it can't pollute the
  round-trip; `.strict()` would reject it if it ever leaked in.
- **Read in the data layer, mutations as actions** — mirrors `projects`. The layout
  imports the data-layer read directly (a layout importing a server action is
  unidiomatic).
- **Sidebar data via session context.** `listSavedViews()` is added to the layout's
  existing parallel fetch and exposed through `SessionValue`, so the client sidebar
  renders it without an extra round-trip; mutations call `router.refresh()` to
  refresh the layout.
- **Generated DB types hand-edited.** `src/types/database.types.ts` is produced by the
  Supabase CLI against the live project, which isn't reachable from here, so the
  `saved_views` entry was added by hand in the generated format. Re-running
  `npm run types:gen` after deploy will reproduce it identically.

---

## 8. Out of scope (deferred) + suggested next step

Deferred, as specified: shared / team views; saved views for any page other than
Tasks; inline editing of an individual filter within a view (re-save instead, via
"Update to current filters"); any new permission key.

**Suggested next step:** add a lightweight "shared with my team" flag (new column +
a second SELECT policy keyed on team membership) once a sharing model is agreed —
the config format and UI already generalize to it.

---

## 9. Manual ops required

**None beyond merging the PR and the normal migration deploy** (`supabase db push`
applies `20260626120000_saved_views.sql`). After deploy, `npm run types:gen`
regenerates `database.types.ts` (the hand-added `saved_views` block matches what the
CLI emits). Confirmed: **no storage-policy change and no service-role usage** in this
PR — the storage references in the proof harness are throwaway shims for the local
PG16 replica only and are not part of the migration or app code.
