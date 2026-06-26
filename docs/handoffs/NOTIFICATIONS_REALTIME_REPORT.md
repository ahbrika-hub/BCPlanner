# Notifications Bundle — Completion Report

Two flag-gated, dormant-by-default notification features: (A) a live notification
bell via Supabase Realtime, and (B) an overdue-escalation daily digest email run
by a Bearer-protected cron route. Both activate only when ops config is set. The
task approval/transition lifecycle was **not** touched, and **no RLS was
broadened**.

---

## 1. Branch

**`feat/notifications-realtime`** — created off `main` as the **first action**,
before any file was modified. `main` already contained the previously-merged
saved-views and findability+hygiene work. Feature branch → PR to `main`; `main`
is never pushed to directly.

---

## 2. Summary + gating behavior

| Part | What ships | Gate / default |
|------|------------|----------------|
| **A — Live bell (Realtime)** | A client subscription to the current user's own `notifications` rows; on any change it calls `router.refresh()`, updating the bell badge + list in place. | `NEXT_PUBLIC_REALTIME_ENABLED` (default **off**). Off/unset **or** subscription failure ⇒ silent fallback to today's refresh-on-navigate. No new write path. |
| **B — Overdue digest email** | A daily cron route computes each recipient's overdue tasks (canonical rule) and sends ONE batched email per recipient via the existing email layer. | Sends only when `EMAIL_ENABLED=true` + `RESEND_API_KEY` + `EMAIL_FROM` (the existing Resend gate). Flag off ⇒ the route still computes the correct recipient set but sends nothing. Route itself is Bearer-`CRON_SECRET` protected (401) and needs the service-role key (503). |

Both are **dormant on merge**: nothing changes behavior until Ahmed sets the env
flags / publication (see §8).

---

## 3. Files changed / added

### Migration
- `supabase/migrations/20260626150000_overdue_digest.sql` — **new**: `overdue_tasks(p_assignee uuid default null)` SECURITY DEFINER fn (canonical overdue rule); `EXECUTE` granted to **service_role only** (explicitly revoked from public/anon/authenticated).

### (B) Overdue digest
- `src/lib/notifications/digest.ts` — **new**: pure `buildDigests()` (recipient scoping + de-dup) and `renderDigestEmail()`.
- `src/app/api/cron/generate-overdue-digest/route.ts` — **new**: Bearer-`CRON_SECRET` + service-role cron mirroring `generate-recurring`; assembles + sends digests via the existing email layer.
- `src/types/database.types.ts` — `overdue_tasks` RPC type.
- `vercel.json` — added the daily cron entry (`0 6 * * *`).
- `.env.example` — documented `CRON_SECRET` usage for the new route + `NEXT_PUBLIC_REALTIME_ENABLED`.

### (A) Realtime bell
- `src/components/notifications/realtime-notifications.tsx` — **new** flag-gated client subscription (scoped `user_id=eq.<id>`), graceful fallback.
- `src/components/layout/app-shell.tsx` — mounts `<RealtimeNotifications/>`.

### Tests / report
- `tests/unit/overdue-digest.test.ts` — **new**: digest scoping/de-dup/render, `emailEnabled` gating boundary, cron 401/503.
- `docs/handoffs/NOTIFICATIONS_REALTIME_REPORT.md` — this report.

---

## 4. Overdue rule reused + manager/assignee scoping

**Exact overdue rule** (mirrors `src/lib/tasks/overdue.ts` and the `listTasks`
overdue filter):
```
due_date IS NOT NULL
AND due_date < current_date
AND status NOT IN ('completed','cancelled','rejected')
```
Encoded once in `overdue_tasks()`.

**Scoping model.** The project has **no explicit manager→report mapping** (no
`manager_id`/`reports_to`; `profiles` only has `department_id`, and the tasks
SELECT RLS grants org-wide visibility to holders of `tasks.read_all`). So:
- **Assignee digest** — `overdue_tasks(<uid>)` → that user's own overdue tasks.
- **Manager/oversight digest** — every active `section_head`/`admin` (the
  `tasks.read_all` roles). Because there is no team mapping and `tasks.read_all`
  is org-wide, the oversight scope is **org-wide overdue tasks** (`overdue_tasks(null)`).
  **Assumption stated:** managers see all overdue tasks, not a dept subset, because
  that mirrors their actual `tasks.read_all` visibility.

---

## 5. De-dup decision: ONE coherent email

A person who is both an assignee (with overdue work) and a manager gets a
**single** email with two clearly separated sections — *"Your overdue tasks"* and
*"Team overdue tasks — oversight"* (the latter excludes their own, already shown
above). **Justification:** one daily email avoids inbox spam and gives a coherent
view; the two sections keep the personal-vs-oversight distinction unambiguous.
`buildDigests()` enforces one digest per recipient and never emits an empty one.

**Batching:** at most one email per recipient per run; recipient count is bounded
by users (assignees-with-overdue ∪ managers); rendered rows are capped at
`MAX_ROWS_PER_SECTION = 100` with an "…and N more" summary. No per-task
notifications are created. The route is designed to be called once daily.

---

## 6. Gate A — actual output

```
npm run lint       → exit 0 (no errors)
npm run typecheck  → exit 0
npm run test       → Test Files 39 passed (39) · Tests 186 passed (186)
npm run build      → exit 0 (both cron routes present):
                       ├ ƒ /api/cron/generate-overdue-digest
                       ├ ƒ /api/cron/generate-recurring
```
**Dependencies:** none added. Realtime ships in the already-present
`@supabase/supabase-js@^2.107.0`; email uses the existing `fetch`-based Resend
layer (no `resend` SDK). `tailwind-merge` stays `^3.6.0` (3.x). `package.json`
unchanged.

New unit test (`tests/unit/overdue-digest.test.ts`), verbose:
```
 ✓ buildDigests > scopes assignee digests to own tasks and managers to org-wide oversight
 ✓ buildDigests > de-dupes: a manager who is also an assignee appears exactly once
 ✓ buildDigests > skips recipients with no resolvable email
 ✓ buildDigests > never produces an empty digest (no overdue → no recipients)
 ✓ renderDigestEmail > renders both sections with counts in the subject
 ✓ emailEnabled gating boundary > is OFF (no-op) unless EMAIL_ENABLED + RESEND_API_KEY + EMAIL_FROM all set
 ✓ emailEnabled gating boundary > would send when all three are configured
 ✓ cron route auth (mirrors generate-recurring) > 401 when CRON_SECRET is unset
 ✓ cron route auth (mirrors generate-recurring) > 401 with a wrong/absent Bearer token
 ✓ cron route auth (mirrors generate-recurring) > 503 with valid Bearer but no service-role key
 Tests  10 passed (10)
```

---

## 7. Gate B — PG16 replica proofs (actual output)

Fresh PostgreSQL **16.13** cluster; prod-only roles + `auth`/`storage` shims via
`CREATE … IF NOT EXISTS`; all migrations applied (incl. `20260626150000`).

### B1 — digest content, ASSIGNEE scope `overdue_tasks(U1)`
Only U1's two overdue tasks; future / completed / cancelled / null-due excluded:
```
     task_no      |           title           |  due_date  |     status
------------------+---------------------------+------------+----------------
 TSS-BC-2026-0002 | U1 overdue pending_review | 2026-06-19 | pending_review
 TSS-BC-2026-0001 | U1 overdue in_progress    | 2026-06-24 | in_progress
(2 rows)
```

### B2 — digest content, MANAGER/oversight scope `overdue_tasks(NULL)`
All overdue org-wide (U1's 2 + the unassigned 1 = 3):
```
     task_no      |           title           |   assignee   |  due_date  |     status
------------------+---------------------------+--------------+------------+----------------
 TSS-BC-2026-0002 | U1 overdue pending_review | User One     | 2026-06-19 | pending_review
 TSS-BC-2026-0001 | U1 overdue in_progress    | User One     | 2026-06-24 | in_progress
 TSS-BC-2026-0003 | Unassigned overdue        | (unassigned) | 2026-06-25 | assigned
(3 rows)
```
Exclusion contrast (every task + its overdue verdict):
```
           title           |  due_date  |     status     | is_overdue
---------------------------+------------+----------------+------------
 U1 cancelled (past date)  | 2026-06-21 | cancelled      | f
 U1 no due date            |            | in_progress    | f
 U1 overdue in_progress    | 2026-06-24 | in_progress    | t
 U1 overdue pending_review | 2026-06-19 | pending_review | t
 U2 completed (past date)  | 2026-06-21 | completed      | f
 U2 future in_progress     | 2026-06-29 | in_progress    | f
 Unassigned overdue        | 2026-06-25 | assigned       | t
```

### Digest GATING — no-op vs would-send
Proven by the `emailEnabled` boundary tests (Gate A): with the flag/keys unset
`emailEnabled()` is `false` and `sendEmail` is a no-op, while `buildDigests()`
still computes the recipient set (B1/B2); with all three set it returns `true`
(would send). The route returns `{ emailEnabled, recipients, sent }` so a run is
observable either way. **Boundary not crossable in-sandbox:** actual Resend
delivery is a MANUAL post-config smoke test (no Resend key here).

### Cron AUTH — 401/503 (mirrors generate-recurring)
Proven by the route tests (Gate A): 401 when `CRON_SECRET` unset, 401 on wrong
Bearer, 503 with valid Bearer but no service-role key.

### Realtime SCOPING — RLS limits delivery to own rows
Realtime rides the existing `notifications_select` RLS (`user_id = auth.uid()`).
As each authenticated user, SELECT returns only their own row — so a per-user
channel can only ever receive that user's notifications:
```
-- as U2:            -- as U1:
 user_id (…002) | U2 note      user_id (…001) | U1 note
```
The client filter is additionally `user_id=eq.<id>`. **Live websocket delivery is
verified manually after enabling** the publication + flag. With the flag off the
bell renders/refreshes exactly as before (component returns null — no
subscription).

### `overdue_tasks` is service_role-only (no RLS-bypass leak)
```
-- as authenticated:
NOTICE:  DENIED as expected: authenticated cannot execute overdue_tasks (service_role only)
```
(Gate B initially caught that the schema's default privileges auto-grant EXECUTE
to `authenticated`; the migration now explicitly revokes from public/anon/authenticated.)

### Lifecycle (`validate_task_transition`) UNCHANGED
```
legal OK: pending_approval
NOTICE:  BLOCKED as expected: Illegal task status transition: draft -> completed
```

---

## 8. MANUAL OPS to activate (Ahmed)

Everything ships dormant. To turn each piece on:

**(A) Live bell**
1. **Add `public.notifications` to the `supabase_realtime` publication** (Supabase
   Dashboard → Database → Replication, or
   `alter publication supabase_realtime add table public.notifications;`). This is
   intentionally **not** done from a migration.
2. Set **`NEXT_PUBLIC_REALTIME_ENABLED=true`** (redeploy — it's a public build-time flag).

**(B) Overdue digest email**
3. Configure Resend: **`EMAIL_ENABLED=true`**, **`RESEND_API_KEY=…`**, **`EMAIL_FROM=…`**.
4. Ensure **`CRON_SECRET`** is set (already used by the recurring cron) and that
   `SUPABASE_SERVICE_ROLE_KEY` + `NEXT_PUBLIC_SUPABASE_URL` are present.
5. **Schedule the route daily.** Recommended: **Vercel Cron** — the entry is
   already added to `vercel.json`:
   ```json
   { "path": "/api/cron/generate-overdue-digest", "schedule": "0 6 * * *" }
   ```
   (Daily 06:00 UTC. An external scheduler hitting the URL with the Bearer
   `CRON_SECRET` works equally.)
6. After enabling, run a one-off smoke test (trigger the route, confirm a real
   email arrives) — the only step not coverable in-sandbox.

---

## 9. Assumptions / decisions, out-of-scope, guarantees

**Assumptions / decisions**
- Manager oversight = org-wide overdue (no team mapping exists; mirrors
  `tasks.read_all`). Stated in §4.
- One coherent email per recipient (§5).
- Realtime updates via `router.refresh()` (re-runs the server components that
  already render the bell + list) rather than duplicating count state on the
  client — minimal, no new write path.
- `overdue_tasks` is callable by `service_role` only (cron), preventing any
  SECURITY DEFINER read leak to ordinary users.

**Out of scope (future):** real-time on anything other than the bell; escalation
beyond a daily overdue digest (no auto-reassign / SLA engine); per-task real-time
notifications; configuring Resend/Realtime/CRON (all manual ops above).

**Guarantees:** No RLS policy was added or broadened. No lifecycle code changed
(`validate_task_transition` untouched — proven). No storage-policy change. The
only new server surface is the cron route, which reuses the **existing**
service-role + `CRON_SECRET` pattern; no new auth path was invented. Manual ops
beyond merge are limited to the env/publication/schedule steps in §8.
