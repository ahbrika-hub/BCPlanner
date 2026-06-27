# Task Dependencies + Subtasks — Implementation Report

Conservative, additive structural relationships over tasks. The lifecycle is
treated as sacred: `validate_task_transition` is **not** modified; the block-start
rule lives in the application layer; cycles are made impossible at the DB level.

---

## 1. Branch + first-action confirmation

- **First action (before any file edit):** created branch
  `feat/task-dependencies-subtasks` off current `main` (`953173a` — "Merge pull
  request #82 …"). No file was touched until the branch existed.
- Feature branch → PR to `main`. Never pushed to `main`. One coherent change set.

```bash
$ git checkout -b feat/task-dependencies-subtasks     # from main @ 953173a
Switched to a new branch 'feat/task-dependencies-subtasks'
```

---

## 2. Summary

- **(A) Task dependencies (block-START).** A new `public.task_dependencies` table
  records "task X is blocked by task Y". A blocked task cannot **enter**
  `in_progress` until **all** its blockers are `completed`. This is enforced in
  the **application** layer (see §5), never by editing the DB transition guard.
  Dependency **cycles are impossible** — a DB trigger (recursive CTE) rejects any
  direct or transitive cycle, and a CHECK rejects self-dependency.
- **(B) Subtasks (structural only).** A new `tasks.parent_id` self-link lets a
  task have children. This PR adds only the link, display, and navigation. A
  CHECK rejects self-parenting and a trigger rejects parent cycles.

> **`validate_task_transition` was NOT modified** (byte-for-byte unchanged — see
> §9). **`generate_task_no` was NOT modified.** The **parent-completion rule**
> ("a parent can't complete with open children") was **NOT built** — it is
> explicitly deferred to a separate follow-up PR. No DB-level enforcement of
> block-start was added (it is application-layer per the governance; see §5).

---

## 3. Files changed / added

### Added — migration
| File | Purpose |
|------|---------|
| `supabase/migrations/20260627120000_task_dependencies_subtasks.sql` | `task_dependencies` table + indexes + RLS; `can_see_task()` helper; dependency cycle trigger; `tasks.parent_id` + self-parent CHECK + parent-cycle trigger. |

### Added — logic / data / actions
| File | Purpose |
|------|---------|
| `src/lib/tasks/dependencies.ts` | Pure block-start model: `STARTABLE_STATUSES`, `isStartTransition`, `blockedStartMessage`. |
| `src/lib/data/dependencies.ts` | `listBlockers` / `listBlocking` / `listIncompleteBlockers` / `addDependency` / `removeDependency` (RLS-scoped). |
| `src/lib/actions/dependencies.ts` | `addDependencyAction` / `removeDependencyAction` — `tasks.update` gate + friendly cycle/self/dupe/RLS messages. |
| `src/lib/validations/dependencies.ts` | `addDependencySchema` (uuid pair + self-dep refine). |

### Added — UI / tests
| File | Purpose |
|------|---------|
| `src/components/tasks/task-dependencies.tsx` | "Blocked by" / "Blocking" editor (add/remove, status pills). |
| `tests/unit/block-start.test.ts` | Block-start across every startable status + unblock + non-start + in_progress-not-startable. |
| `tests/unit/dependencies.test.ts` | Add action: permit/deny, self-reject, friendly cycle/dupe mapping. |

### Modified
| File | Change |
|------|--------|
| `src/types/database.types.ts` | `task_dependencies` types + `tasks.parent_id` + self-FK relationship. |
| `src/lib/validations/tasks.ts` | `parent_id` optional on the task fields (subtask creation). |
| `src/lib/validations/index.ts` | Export `./dependencies`. |
| `src/lib/data/tasks.ts` | `listSubtasks` + `getTaskBrief` (TaskBrief). |
| `src/lib/actions/collaboration.ts` | **Block-start gate** in `addUpdateAction`. |
| `src/lib/actions/tasks.ts` | Defensive block-start in `transitionTaskAction` for `to: in_progress` (future-proof); `parent_id` flows via create. |
| `src/components/tasks/new-task-dialog.tsx` | Optional `parentId` → create a subtask via the existing path. |
| `src/components/tasks/task-action-bar.tsx` | Disable the start (Log Progress) affordance when blocked. |
| `src/components/tasks/task-detail-content.tsx` | Relationships card (parent link, subtasks, dependencies) + add-subtask + start-blocked reason. |

No dependencies added; `tailwind-merge` stays `^3.6.0` (see §8).

---

## 4. Cycle-prevention approach (trigger/DB function) + why

**DB trigger with a recursive CTE — chosen over an application walk** so a cycle
**cannot be persisted by any client**, even one that bypasses the app.

- `check_task_dependency_cycle()` — `BEFORE INSERT` on `task_dependencies`.
  Adding edge "task_id depends_on depends_on_task_id" forms a cycle iff the
  blocker already (transitively) depends on the blocked task; the function walks
  the dependency chain forward from the new blocker and rejects if it reaches the
  blocked task. Self-dependency is also rejected (belt-and-suspenders with the
  table CHECK).
- `check_task_parent_cycle()` — `BEFORE INSERT OR UPDATE OF parent_id` on `tasks`
  (fires only when `parent_id` changes — never on a status transition). Walks the
  ancestor chain and rejects self-parent / parent cycles.

**Both functions are `SECURITY DEFINER` with an empty `search_path`.** This is a
deliberate correctness fix found during Gate B: a `SECURITY INVOKER` cycle check
runs RLS-scoped, so a user who can't see an intermediate dependency edge could
close a cycle *through* it undetected. As `DEFINER`, the recursive walk always
sees the **complete** graph, making cycle prevention global and un-bypassable.
They are trigger functions (no useful direct-call surface).

---

## 5. Every path into `in_progress`, and how block-start covers it

**Key inspection finding.** The DB guard's legal pairs into `in_progress` are
`approved→`, `assigned→`, `pending_update→`, `returned_for_modification→`,
`reopened→in_progress`. But in the **application**, a task enters `in_progress`
through exactly **one** path:

> logging a progress update — `addUpdateAction` → `task_updates` insert → the
> **`apply_task_update` trigger**, which advances `assigned` / `approved` /
> `pending_update` → `in_progress`.

`transitionTaskAction` has **no** action whose target is `in_progress` (the
`ACTIONS` table has no `to: "in_progress"`; `log_progress` has no `to` and is
rejected by `transitionTaskAction`). The guard-legal pairs
`returned_for_modification→in_progress` and `reopened→in_progress` are therefore
**not reachable by any application code today** (the trigger does not advance
those statuses, and no action targets `in_progress`).

**So the block-start gate is placed where the start actually happens:**

| Path into in_progress | Where gated |
|-----------------------|-------------|
| Log progress on `assigned` (→ trigger) | `addUpdateAction` — **gated** |
| Log progress on `approved` (→ trigger) | `addUpdateAction` — **gated** |
| Log progress on `pending_update` (→ trigger) | `addUpdateAction` — **gated** |
| (hypothetical future action `to: in_progress`) | `transitionTaskAction` — **gated (defensive, unreachable today)** |
| `returned_for_modification` / `reopened` → in_progress | no app path exists (documented) |

`addUpdateAction` fetches the task; if its status is in `STARTABLE_STATUSES`
(`assigned`/`approved`/`pending_update` — the trigger's advancing set) and any
blocker is not `completed`, it returns `Blocked by <task_no> (not completed).`
**before** inserting the update — so the trigger never runs and the status cannot
advance. Already-started tasks and non-advancing statuses are unaffected. The DB
guard is never reached for a blocked start.

This is the application-layer enforcement the governance requires; no DB-level
(guard) enforcement was added. (If DB-level enforcement is ever wanted, it would
be a separate PR touching `apply_task_update`, not `validate_task_transition`.)

---

## 6. Dependency RLS / permission gate + justification

`can_see_task(p_task_id)` (SECURITY DEFINER) re-expresses the `tasks_select`
visibility rule (creator **or** assignee **or** `tasks.read_all`) as a boolean.

| Op | Policy |
|----|--------|
| SELECT | `can_see_task(task_id) AND can_see_task(depends_on_task_id)` — a dependency is visible only when the caller can see **both** tasks. |
| INSERT | `authorize('tasks.update') AND can_see_task(task_id) AND can_see_task(depends_on_task_id)` |
| DELETE | same as INSERT |

**Justification.** Dependencies are task-edit operations, so they reuse the exact
key the edit path checks (`tasks.update`) rather than inventing a new permission.
Pairing it with **visibility of both tasks** prevents a user from linking (or
revealing the existence of) a task they cannot see. Task RLS itself is unchanged;
this is a new table with its own policies only. Proven in §9 (RLS), including that
the two gates are independent: a `read_all`-but-no-`tasks.update` user (ceo) and a
`tasks.update`-but-can't-see user (employee) are each denied.

---

## 7. Subtask model + explicitly deferred lifecycle couplings

- `tasks.parent_id uuid null references tasks(id) on delete set null`, indexed. A
  task with a `parent_id` is a subtask. Self-parent rejected by CHECK
  (`tasks_parent_not_self`); parent cycles rejected by `check_task_parent_cycle`.
- Subtasks are ordinary tasks: they obey the **unchanged** task RLS/visibility,
  appear in the list/board/calendar, and are created via the **existing**
  creation path (`createTaskAction` with `parent_id`, surfaced as "Add subtask").
- **Deferred to a separate follow-up PR (NOT built here):** any parent/child
  lifecycle coupling — notably "a parent cannot complete while it has open
  children". No such rule exists in this PR; parent and child statuses are fully
  independent (proven in §9).

---

## 8. Gate A — actual output

```text
$ npm run lint        → exit 0 (no errors)
$ npm run typecheck   → exit 0 (tsc --noEmit)
$ npm run test        → Test Files 46 passed (46) · Tests 234 passed (234)
$ npm run build       → ✓ Compiled successfully; exit 0
```

**Dependencies:** none added. `tailwind-merge` stays `^3.6.0` (3.x);
`package.json` / lock unchanged.

New focused tests:
```text
✓ block-START in addUpdateAction > REJECTS starting a assigned task with an incomplete blocker
✓ block-START in addUpdateAction > REJECTS starting a approved task with an incomplete blocker
✓ block-START in addUpdateAction > REJECTS starting a pending_update task with an incomplete blocker
✓ block-START in addUpdateAction > ALLOWS starting once every blocker is completed
✓ block-START in addUpdateAction > does NOT block a progress update on an already in_progress task
✓ block-START in addUpdateAction > in_progress is NOT a startable status
✓ addDependencyAction > adds a dependency when permitted
✓ addDependencyAction > rejects a self-dependency before touching the DB
✓ addDependencyAction > is denied without tasks.update
✓ addDependencyAction > maps a DB cycle error to a friendly message
✓ addDependencyAction > maps a unique-violation to 'already exists'
```

---

## 9. Gate B — real PG16 behavioral proofs

Fresh PostgreSQL **16.13** cluster (unprivileged `pgtest`); prod-only `auth`/
`storage` shimmed; **all 42** migration files applied in order.

### Schema present
```text
 table_name = task_dependencies
 tasks.parent_id = uuid
 trigger guard_task_dependency_cycle (on task_dependencies)
 constraint tasks_parent_not_self
 roles with tasks.update: admin, section_head, employee   (ceo excluded)
```

### Cycle prevention (direct + transitive)
```text
A→B succeeds:                       inserted A depends_on B
B→A REJECTED:    Adding this dependency would create a cycle
B→C succeeds:                       inserted B depends_on C
C→A REJECTED:    Adding this dependency would create a cycle   (transitive A→B→C→A)
```

### Self rejections
```text
self-dependency REJECTED: A task cannot depend on itself
self-parent     REJECTED: A task cannot be its own parent
parent cycle    REJECTED: Setting this parent would create a subtask cycle
```

### Block-start (substrate) — incomplete-blocker check per startable status
B-variants each blocked by A. While A is not completed, the app's
incomplete-blocker check returns A for every startable status; once A is
completed (via the legal `pending_review→completed` path), all clear, and a
progress update then advances the task to `in_progress`:
```text
A status: pending_review
  assigned        incomplete_blockers = 1
  approved        incomplete_blockers = 1
  pending_update  incomplete_blockers = 1
A now completed
  assigned        incomplete_blockers = 0
  approved        incomplete_blockers = 0
  pending_update  incomplete_blockers = 0
log progress on BA (assigned) → BA_after_update = in_progress     (unblocked start works)
cancel BX (assigned→cancelled) → BX cancelled                     (NON-start transition NOT blocked)
```
> The authoritative proof that the **action refuses** a blocked start (no update
> written → no advance) is the vitest `block-start` suite (§8), since block-start
> is application-layer by design. Gate B proves the DB substrate: the check is
> correct per startable status, the trigger is the in_progress mechanism, and
> unblock-after-complete advances end-to-end.

### Guard untouched
```text
$ git diff main -- supabase/migrations/20260606141054_tasks_core.sql
(no output — validate_task_transition byte-for-byte unchanged)

behavioral: legal assigned→pending_review: pending_review   (passes)
            illegal →completed: guard still raises ("closure_summary is required…")
```

### RLS on task_dependencies (gates isolated)
```text
BOB   sees dep rows: 0   (cannot see Eve's task in the pair)
ADMIN sees dep rows: 1   (read_all → sees both)
CEO   (read_all, NO tasks.update) non-cycle INSERT:
        DENIED — new row violates row-level security policy        (tasks.update gate)
BOB   (tasks.update, cannot see T1) non-cycle INSERT:
        DENIED — new row violates row-level security policy        (both-visible gate)
ADMIN (tasks.update + sees both) same INSERT: succeeds
```

### Subtasks (structural; RLS; no lifecycle change)
```text
SUB.parent_id resolves → parent "Parent task"
BOB sees Eve-owned child: 0        (subtasks obey unchanged task RLS)
parent_status = assigned, child_status = assigned   (statuses independent — no coupling)
```

---

## 10. Assumptions / decisions, out-of-scope, manual ops

**Decisions**
- **Block-start lives in `addUpdateAction`** (the real path into `in_progress`),
  with a defensive check in `transitionTaskAction` for any future
  `to: in_progress` action. `validate_task_transition` untouched (governance).
- **Cycle checks are `SECURITY DEFINER`** so they see the whole graph and can't
  be bypassed by RLS-limited callers (found and fixed during Gate B).
- **Dependency gate = `tasks.update` + visibility of both tasks** (reuses the
  edit key; no new permission). Task RLS itself unchanged.
- **Subtasks reuse the existing create path** (`createTaskAction` + `parent_id`);
  no re-parenting UI in this PR (the parent-cycle trigger still guards updates).
- No-due-date and other view behaviors are unaffected.

**Out of scope (deferred, explicitly noted as future)**
- Parent completion blocked by open children (**separate next PR**).
- Block-**completion** dependencies; DB-level (guard) enforcement of block-start;
  dependency arrows in a timeline/Gantt; auto-notify on unblock; bulk dependency
  editing.

**Manual ops:** **none** beyond the normal merge + `supabase db push` of the one
new migration. No storage change, no service-role usage, no new permission key,
no broadening of task RLS.
