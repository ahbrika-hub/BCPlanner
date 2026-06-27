# Kanban Board + Planning Calendar — Implementation Report

Two additive **visual views** over the existing task data — a grouped-lane Kanban
**Board** and a read-only planning **Calendar**. No schema change, no new
transition path: the board only *calls* the existing `transitionTaskAction` (and
through it the DB `validate_task_transition` guard), and the calendar only reads.

---

## 1. Branch + first-action confirmation

- **First action (before any file edit):** created branch `feat/kanban-calendar`
  off current `main` (`3a5a797` — "Merge pull request #81 …"). No file was
  touched until the branch existed.
- Feature branch → PR to `main`. Never pushed to `main`. One coherent change set.

```
$ git checkout -b feat/kanban-calendar     # from main @ 3a5a797
Switched to a new branch 'feat/kanban-calendar'
```

---

## 2. Summary + migration statement

- **(A) Kanban Board** (`/board`) — the 12 statuses are grouped into 5 lanes.
  Dragging a card to another lane resolves to **one** guard-legal transition and
  runs the **existing** `transitionTaskAction` — same permission check, same DB
  guard, same notifications. Illegal drops are **rejected** (revert + toast), not
  forced. Required-field transitions are **never** committed silently. Cards with
  no permitted move have no drag affordance. Optimistic move with revert on
  failure. A per-card **Move menu** is the keyboard-/touch-accessible equivalent
  of the pointer drag; lanes scroll horizontally on a phone.
- **(B) Planning Calendar** (`/calendar`) — read-only Sunday-first month grid
  plotting tasks on `due_date`; clicking a task opens it via the existing modal
  intercept. Overdue tasks are marked with the canonical rule. Tasks with **no
  due date** are listed in a "No due date" area beneath the grid (not dropped).
  No writes, no drag, no reschedule in this PR.
- Both views reuse the same RLS-scoped `listTasks` data source and the same URL
  filter params as the list; a **View switcher** (List / Board / Calendar)
  carries the current filters across.

> **NO new migration.** Both views are read/transition layers over existing
> tables. `validate_task_transition` and `generate_task_no` are unchanged; RLS is
> not broadened. Gate B applies the existing **41** migration files unchanged.

---

## 3. Files changed / added

### Added — logic (framework-agnostic, unit-tested)
| File | Purpose |
|------|---------|
| `src/lib/tasks/board.ts` | Lane model + `resolveBoardDrop` / `descriptorForDrop` / `actionableTargets` — resolves a drop to one existing ACTIONS descriptor; never invents a transition. |
| `src/lib/tasks/calendar.ts` | `buildCalendarMonth` / `splitByDueDate` — pure due-date bucketing + month grid, overdue via the canonical rule. |

### Added — UI
| File | Purpose |
|------|---------|
| `src/components/tasks/kanban-board.tsx` | Client board: native HTML5 DnD + Move menu; optimistic move; illegal/needs-fields/permission handling; calls `transitionTaskAction`. |
| `src/components/tasks/planning-calendar.tsx` | Client read-only calendar; chips link to `/tasks/[id]`; month nav is local state. |
| `src/components/tasks/view-switcher.tsx` | List / Board / Calendar segmented control, preserves the shared query string. |
| `src/app/(app)/board/page.tsx` | Server page: `tasks.read` gate, same server filters as the list, RLS-scoped `listTasks`. |
| `src/app/(app)/calendar/page.tsx` | Server page: `tasks.read` gate, same filters, read-only. |

### Added — tests
| File | Purpose |
|------|---------|
| `tests/unit/board-transitions.test.ts` | Lane mapping + that every drop resolves to a real ACTIONS descriptor (no direct status write) + legal/illegal/needs-fields/permission verdicts. |
| `tests/unit/planning-calendar.test.ts` | Due-date bucketing, day placement, overdue, undated separation, whole-weeks grid. |

### Modified
| File | Change |
|------|--------|
| `src/components/layout/nav-config.ts` | Added **Board** + **Calendar** nav items (Work group), gated `tasks.read`. |
| `src/app/(app)/tasks/page.tsx` | Rendered `<ViewSwitcher />` in the header (non-CEO branch). |

No dependency changes (see Gate A). `package.json` / lock untouched.

---

## 4. Final lane → status mapping and PRIMARY drop target

Every one of the 12 statuses maps to exactly one lane (asserted by a test).

| Lane | Statuses | **Primary drop target** | Action a drop resolves to |
|------|----------|-------------------------|---------------------------|
| **To Do** | draft, pending_approval, approved, assigned, reopened | `reopened` | `reopen` (from completed/cancelled/rejected) |
| **In Progress** | in_progress, pending_update | *(none — not a drop target)* | — |
| **In Review** | pending_review, returned_for_modification | `pending_review` | `submit_review` (from assigned/approved/in_progress/pending_update/returned_for_modification/reopened) |
| **Done** | completed | `completed` | `close` (from pending_review) |
| **Cancelled / Rejected** | cancelled, rejected | `cancelled` | `cancel` (from the in-flight statuses) |

**Why In Progress is not a drop target:** the lifecycle reaches `in_progress`
only through *logging progress* (`log_progress`, which intentionally has **no**
`to` and is rejected by `transitionTaskAction`). There is no guard-legal status
*write* into `in_progress`, so the board does not offer it as a drop target —
"start work" stays the **Log Progress** action on the task detail. Dropping there
shows an explanatory toast and commits nothing.

A drop onto a card's **own** lane is a no-op. A cross-lane drop resolves the
action whose `to` is the destination lane's primary target **and** whose `from`
includes the card's current status; if none exists, the drop is illegal.

---

## 5. Required-fields handling decision (per affected transition)

The board commits **only** transitions that require no extra input. Any
transition needing extra fields is **not** committed from the board — it opens
the task (the modal intercept), where the existing **action-bar dialog** collects
the fields. This is option (ii) "disallow the board drop and direct to task
detail", applied uniformly so a required field can **never** be bypassed.

| Lane / transition | `requires` | Board behavior |
|-------------------|-----------|----------------|
| In Review → `submit_review` | none | **Direct commit** via `transitionTaskAction`. |
| To Do → `reopen` | none | **Direct commit**. |
| Cancelled/Rejected → `cancel` | none | **Direct commit**. |
| **Done → `close`** | **closure_summary + quality_rating** | **Opens the task** ("Close needs more details — opening …"); the action bar's closure dialog collects them. Board writes nothing. |

`assign` (requires an assignee) and `reject`/`return` (require a reason) are not
any lane's primary drop target, so they are reached only via the detail action
bar — consistent with the same "never bypass a required field" rule.

---

## 6. Proof-of-reuse — drops call the existing action, never a direct write

- `KanbanBoard` imports exactly one mutation: `transitionTaskAction` from
  `@/lib/actions/tasks`. It contains **no** Supabase client, **no** `updateTask`,
  **no** status write — the drag is only a trigger.
- `src/lib/tasks/board.ts` resolves every actionable drop to an entry of the
  shared `ACTIONS` array (the single source of truth that mirrors the DB guard);
  the test *"descriptorForDrop never invents a transition"* asserts the returned
  descriptor is an `ACTIONS` member whose `to` equals the lane's primary target
  and whose `from` includes the card's status.
- The calendar pages/components import **no** action and **no** mutation — read
  only.

```
$ grep -rn "transitionTaskAction\|updateTask\|\.from(\"tasks\")\|supabase" \
    src/components/tasks/kanban-board.tsx src/components/tasks/planning-calendar.tsx
src/components/tasks/kanban-board.tsx:10:import { transitionTaskAction } from "@/lib/actions/tasks";
src/components/tasks/kanban-board.tsx:123:          const res = await transitionTaskAction(task.id, action);
```
(One import, one call site, no direct DB/status write. Calendar: no matches.)

---

## 7. Gate A — actual output

```text
$ npm run typecheck
> tsc --noEmit
(exit 0 — no errors)

$ npm run lint
> eslint
(exit 0 — 0 problems)

$ npm run test
> vitest run
 Test Files  44 passed (44)
      Tests  223 passed (223)
   (44 new board/calendar assertions across 2 new files; 199 pre-existing still green)

$ npm run build
> next build
✓ Compiled successfully
Route (app)
├ ƒ /board
├ ƒ /calendar
├ ƒ /tasks
├ ƒ /tasks/[id]
├ ƒ /(.)tasks/[id]
…
(exit 0 — /board and /calendar present; intercept route intact)
```

**Dependencies:** none added. Drag uses **native HTML5 DnD** (no drag library);
the Move menu reuses the existing `dropdown-menu` primitive. `tailwind-merge`
stays `^3.6.0` (3.x); `package.json` / lock unchanged.

New focused tests:
```text
✓ lane model > maps every one of the 12 statuses to exactly one lane
✓ descriptorForDrop never invents a transition > only ever returns an ACTIONS descriptor whose `to` is the lane's primary target
✓ resolveBoardDrop verdicts > LEGAL no-extra-fields move → ready (assigned → Review = submit_review)
✓ resolveBoardDrop verdicts > ILLEGAL move → illegal (draft → Review …)
✓ resolveBoardDrop verdicts > required-fields move → needs_fields, NOT a silent commit (pending_review → Done = close)
✓ resolveBoardDrop verdicts > legal move but missing permission → needs_permission
✓ resolveBoardDrop verdicts > dropping onto In Progress → not_target
✓ buildCalendarMonth > plots a task on its due_date cell / marks today / undated separately
```

---

## 8. Gate B — real PG16 behavioral proofs

Fresh PostgreSQL **16.13** cluster (unprivileged `pgtest` user, trust auth, short
socket path). Prelude shims the prod-only `auth`/`storage` schemas + `auth.uid()`
+ API roles, then applies **all 41** migration files in order (no new migration).

### Lifecycle objects the board relies on (present, unchanged — board only calls them)
```text
        tgname         | tgenabled |     kind
-----------------------+-----------+---------------
 guard_task_transition | O         | BEFORE UPDATE
 set_task_no           | O         | BEFORE INSERT
```

### BOARD — legal move (assigned → In Review/`pending_review` = `submit_review`)
```text
 before: assigned
 after : pending_review  (LEGAL move committed)
```

### BOARD — illegal move REJECTED BY THE GUARD, not the UI (draft → `pending_review`)
```text
 before: draft
NOTICE:  BLOCKED by guard as expected: Illegal task status transition: draft -> pending_review
 after : draft  (UNCHANGED — guard rejected)
```

### BOARD — required fields NOT bypassable (Done = `close` → completed)
```text
NOTICE:  BLOCKED (missing closure fields): closure_summary is required to complete a task
 after attempt without fields: pending_review  (still pending_review)
 after WITH fields: completed rating=5  (completed only WITH required fields)
```

### BOARD — other lane primaries are guard-legal (reopen, cancel)
```text
 reopen completed->reopened: reopened
 cancel in_progress->cancelled: cancelled
```

### BOARD — permission (proven at Gate A unit level + server action)
`resolveBoardDrop("assigned", Review, [])` → `needs_permission` → the card gets
no drag affordance for that move and the Move menu omits it; if forced, the
server `transitionTaskAction` re-checks `can(desc.permission)` and returns
`Not authorized.` (no new auth path).

### CALENDAR — read-only + RLS-scoped visibility
Tasks seeded for Eve and Bob; read under each user's JWT via the `tasks_select`
RLS policy (`created_by = uid OR assignee_id = uid OR tasks.read_all`):
```text
--- As Eve (employee, no tasks.read_all): only her own/assigned (NOT Bob's) ---
    title     |  due_date
--------------+------------
 Eve assigned | 2026-06-20
 Eve owns     | 2026-06-15

--- As Bob: only Bob's rows (incl. the no-due-date one → "No due date" area) ---
   title    |  due_date
------------+------------
 Bob no-due |
 Bob owns   | 2026-06-15
```
The calendar performs no writes (no action import); RLS — unchanged by this PR —
scopes what it can render.

### Lifecycle untouched — `generate_task_no` still sequential
```text
 TSS-BC-2026-0009
 TSS-BC-2026-0010
```

---

## 9. Assumptions / decisions, out-of-scope, manual ops

**Decisions**
- **Top-level routes** `/board` + `/calendar` (not `/tasks/board`) to avoid
  colliding with the `(.)tasks/[id]` intercept (which would match `/tasks/board`
  as `id="board"`). The `@modal` slot still intercepts `/tasks/[id]` from these
  pages, so card/chip clicks open the task modal via soft-nav.
- **Gate = `tasks.read`** for both views (employee/section_head/admin), matching
  the standard Tasks list. The CEO's oversight surface is intentionally **not**
  reframed as a board/calendar — it is assignee-blind via a SECURITY DEFINER fn,
  and `listTasks` would not reproduce that shape — so the CEO is redirected to
  `/tasks`. (CEO has `tasks.create`+`tasks.read_all` but not `tasks.read`, so the
  Board/Calendar nav items don't show for them.)
- **No-due-date tasks** are shown (not dropped) in a "No due date" area beneath
  the calendar grid.
- **Touch drag:** native HTML5 DnD is pointer-based; the per-card **Move menu** is
  the keyboard- and touch-accessible equivalent and runs the identical action
  path. Lanes scroll horizontally on small screens.
- **Move onto own lane** is a no-op; **In Progress** accepts no drops (see §4).

**Out of scope (future):** drag-to-reschedule on the calendar; per-lane WIP
limits; swimlanes by assignee/business-line; saving a board/calendar as a saved
view; Gantt/timeline.

**Manual ops:** **none** beyond the normal merge. No new migration, no storage
policy change, no service-role usage, no new permission key, no RLS change.
