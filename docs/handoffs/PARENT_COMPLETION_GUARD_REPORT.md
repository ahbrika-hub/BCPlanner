# Parent-Completion Guard — Implementation Report

One lifecycle-coupling rule for subtasks: a **parent** task cannot enter
`pending_review` (submit-for-review) while any of its **child** subtasks is still
**open** (non-terminal). Enforced in the application layer; the DB transition
guard is untouched.

---

## 1. Branch + first-action confirmation

- **First action (before any file edit):** created branch
  `feat/parent-completion-guard` off current `main` (`7e2f301` — "Merge pull
  request #83 …", which includes `parent_id`). No file was touched until the
  branch existed.
- Feature branch → PR to `main`. Never pushed to `main`. One coherent change set.

```bash
$ git checkout -b feat/parent-completion-guard     # from main @ 7e2f301
Switched to a new branch 'feat/parent-completion-guard'
```

---

## 2. Summary

When a task is submitted for review, if it is a **parent** with any **open**
child subtask, the submit is **rejected** with the blocking child task numbers
(`Has open subtasks: TSS-BC-… , TSS-BC-…`) and its status is **unchanged**. Leaf
tasks (no children) and parents whose children are **all terminal** proceed
exactly as before.

> **`validate_task_transition` was NOT modified** (byte-for-byte unchanged — §7).
> `generate_task_no` untouched. The rule is enforced in the application
> (`transitionTaskAction`) **before** the guard is called. No other coupling was
> added (no block at `completed` beyond what flows from blocking `pending_review`,
> no cascade, no child-depends-on-parent).

---

## 3. Files changed / added

### Added
| File | Purpose |
|------|---------|
| `supabase/migrations/20260627130000_open_subtasks_fn.sql` | `open_subtasks(parent_id)` — **SECURITY DEFINER** helper returning a parent's non-terminal children (id + task_no). |
| `src/lib/tasks/parent-guard.ts` | Pure model: `TERMINAL_STATUSES`, `isOpenStatus`, `openSubtasksMessage`. |
| `tests/unit/parent-completion-guard.test.ts` | Block / all-terminal-allowed / leaf / non-submit-unaffected / terminal-set + deadlock-avoidance. |

### Modified
| File | Change |
|------|--------|
| `src/lib/data/tasks.ts` | `listOpenSubtasks(parentId)` → calls the `open_subtasks` RPC. |
| `src/lib/actions/tasks.ts` | `transitionTaskAction`: when `desc.to === "pending_review"`, reject if open children exist. |
| `src/components/tasks/task-action-bar.tsx` | Disable the Submit-for-Review affordance when blocked (`submitBlockedReason`). |
| `src/components/tasks/task-detail-content.tsx` | Compute the block reason from `open_subtasks` and pass it to the action bar. |
| `src/types/database.types.ts` | `open_subtasks` RPC type. |

### Was a migration needed? Yes — justified

The rule could have been a plain RLS-scoped child query (no migration). It is
**not**, because that would be **incomplete**: a child may be created by / assigned
to someone other than the parent's submitter, so an RLS-scoped count (run in the
submitter's visibility) could **miss** open children the submitter can't see —
letting them bypass the rule. The `open_subtasks` function is `SECURITY DEFINER`
(empty `search_path`) so it sees **all** children. This mirrors the dependency /
parent **cycle** checks from the previous PR, made `SECURITY DEFINER` for exactly
this completeness reason. The function returns only non-terminal children of one
parent (id + task_no) — it discloses nothing beyond "this parent has these open
subtasks" to a caller already acting on the parent, and does **not** broaden task
RLS. Proven complete in §7 (definer-completeness). `tailwind-merge` unchanged; no
npm dependency added.

---

## 4. Complete list of real entry paths into `pending_review`

Enumerated from inspection (the previous PR proved the obvious path isn't always
the real one):

| Candidate path | Reaches `pending_review`? | Covered |
|----------------|---------------------------|---------|
| `transitionTaskAction(id, "submit_review")` (`to: "pending_review"`) | **Yes — the only one** | **Gated** (the open-children check sits here) |
| `apply_task_update` trigger (progress log) | **No** — its `case` only sets `in_progress`, else keeps status | n/a (proven in §7) |
| Bulk actions (`bulk-queue`) | **No** — `submit_review` is not in `BULK_ACTIONS` (`approve/reject/return/close/cancel`) | n/a |
| `convertCeoRequestAction` | **No** — composes `approve` + `assign` only | n/a |

`submit_review` is the **sole** action whose `to` is `pending_review`, and
`transitionTaskAction` is the single chokepoint for it (bulk and CEO-convert both
route through it but never with `submit_review`). The check therefore covers
**every** real entry path. Gate B confirms the trigger keeps a task `in_progress`
(never advances it to `pending_review`).

---

## 5. Terminal-status set + deadlock-avoidance rationale

**Terminal = `completed`, `cancelled`, `rejected`.** "Open child" = a child in any
**non-terminal** status. A terminal child never blocks its parent.

This is the locked deadlock-avoidance contract: if a `cancelled` or `rejected`
child still blocked the parent, the parent could **never** be submitted for review
(those statuses are effectively final — they only leave via `reopened`), so a
single cancelled child would deadlock the parent forever. Excluding all three
terminal states means a parent is blocked only by children that can still
realistically progress. (Defined independently of `OVERDUE_EXCLUDED_STATUSES`,
which coincidentally holds the same three values for an unrelated reason, so the
two can't silently drift.)

---

## 6. Gate A — actual output

```text
$ npm run lint        → exit 0 (no errors)
$ npm run typecheck   → exit 0 (tsc --noEmit)
$ npm run test        → Test Files 47 passed (47) · Tests 241 passed (241)
$ npm run build       → ✓ Compiled successfully; exit 0
```

**Dependencies:** none added. `tailwind-merge` stays `^3.6.0` (3.x).

New tests:
```text
✓ parent-completion guard (submit_review) > REJECTS submit_review while a child is OPEN — status unchanged, no transition
✓ parent-completion guard (submit_review) > lists EVERY open child in the message
✓ parent-completion guard (submit_review) > ALLOWS submit_review when all children are terminal
✓ parent-completion guard (submit_review) > ALLOWS submit_review for a leaf task (no children)
✓ parent-completion guard (submit_review) > does NOT apply the open-children check to a non-submit transition (cancel)
✓ terminal-status contract (deadlock-avoidance) > treats exactly completed/cancelled/rejected as terminal
✓ terminal-status contract (deadlock-avoidance) > cancelled and rejected children are NOT open
```

---

## 7. Gate B — real PG16 behavioral proofs

Fresh PostgreSQL **16.13** cluster; prod-only `auth`/`storage` shimmed; **all 43**
migration files applied.

### Helper present + SECURITY DEFINER
```text
    proname    | security_definer
---------------+------------------
 open_subtasks | t
```

### Block / allow per scenario (the app rejects iff `open_subtasks()` is non-empty)
```text
P1 (child in_progress)            → BLOCKED  open_subtasks → TSS-BC-2026-0008
P2 (only child REJECTED)          → ALLOWED  open_children = 0   (terminal child, no deadlock)
P3 (all children COMPLETED)       → ALLOWED  open_children = 0
P4 (one completed + one in_progress) → BLOCKED  open_subtasks → TSS-BC-2026-0013 (the open one only)
L1 (leaf, no children)            → ALLOWED  open_children = 0
```

### Deadlock-avoidance (the critical proof) — cancel/reject does NOT block
```text
P1 blocked; CANCEL C1 (in_progress→cancelled): C1 cancelled
open_subtasks(P1) after cancel = 0  →  submit P1: P1 pending_review   (now allowed)
P2's only child was REJECTED        →  open_children = 0              (allowed)
```

### All-terminal allowed; leaf unaffected
```text
submit P3 (all children completed): P3 pending_review
submit L1 (leaf):                    L1 pending_review
```

### Progress-log trigger never reaches `pending_review`
```text
log progress on in_progress P5 (open child) → P5_after_progress_log = in_progress
```
(Confirms `submit_review` is the only entry into `pending_review` — the gate's
single location is sufficient.)

### DEFINER completeness — blocks on a child the submitter can't see
Pdef owned by Eve; its open child Cdef owned by Bob (Eve can't see Cdef via task RLS):
```text
As EVE: plain RLS child query     → eve_rls_visible_children = 0   (misses Bob's child)
        open_subtasks(Pdef)       → definer_sees_open_child = TSS-BC-2026-0015
```
A naive RLS-scoped check would have let Eve submit Pdef despite an open child;
the `SECURITY DEFINER` helper keeps it blocked. This is the reason for the migration.

### Guard untouched
```text
$ git diff main -- supabase/migrations/20260606141054_tasks_core.sql
(no output — validate_task_transition byte-for-byte unchanged)

behavioral: legal assigned→pending_review: pending_review   (passes)
            illegal →completed: guard still raises ("closure_summary is required…")
```

---

## 8. Assumptions / decisions, out-of-scope, manual ops

**Decisions**
- Check placed in `transitionTaskAction` keyed on `desc.to === "pending_review"`
  — the sole real entry (§4). `validate_task_transition` untouched (governance).
- **One migration added** (the `SECURITY DEFINER` `open_subtasks` helper) — not
  strictly required for a happy-path implementation, but required for the rule to
  be **complete** (block on children the submitter can't see); justified in §3.
- Terminal set = completed/cancelled/rejected, locked for deadlock-avoidance (§5).
- UI affordance (disabled Submit-for-Review + reason) is driven by the same
  `open_subtasks` helper, so it reflects all open children; the server enforces
  regardless of UI.

**Out of scope (deferred, noted as future)**
- Blocking at `completed` independently; cascading status to children;
  auto-submitting the parent when the last child closes; notifications on unblock;
  applying the rule to dependency-blockers (the separate dependencies feature).

**Manual ops:** **none** beyond the normal merge + `supabase db push` of the one
new migration (the `open_subtasks` function). No table/RLS change, no storage
change, no service-role usage, no new permission key, no broadening of task RLS.
