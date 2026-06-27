# Workload & Capacity Upgrade — Completion Report

Four changes on the existing workload surface and the single central working-day
helper: (A) effort-HOURS workload model, (B) over/under-capacity color cues,
(C) drag-to-reassign (reusing the existing assign action), (D) admin-editable
public-holiday capacity calendar. No flag-gating, no new auth surface. The task
approval/transition lifecycle was **not** touched, and **no RLS was broadened**
beyond the new `public_holidays` table's own policies.

---

## 1. Branch

**`feat/workload-capacity`** — created off `main` as the **first action**, before
any file was modified. Feature branch → PR to `main`; `main` is never pushed to.

---

## 2. Summary

- **(A) Effort-HOURS model** — load is now classified by **hours-vs-capacity
  utilization %**, not the old task-count thresholds (>5/>2). Task count is kept
  as a secondary column. Applied in both the SQL view and the central TS helper.
- **(B) Color cues** — each workload row is colored by utilization band (under /
  near / over capacity) via brand `@theme` tokens, always paired with a text
  label (a band pill + a left-border cue + a cutoffs legend) — never color-only.
- **(C) Drag-to-reassign** — a `tasks.assign` holder drags a task chip onto a
  teammate; the drop calls the **existing** `transitionTaskAction(id,"assign",…)`
  (same permission, transition guard, notifications). Optimistic move, revert +
  toast on failure. No affordance without `tasks.assign`; no new server path.
- **(D) Public-holiday calendar** — a seeded (Saudi 2026), admin-editable
  `public_holidays` table. The **single** central working-day helper subtracts
  holidays from capacity, so every caller inherits it.

---

## 3. Files changed / added

### Migrations
- `supabase/migrations/20260626160000_public_holidays.sql` — **new** table + RLS (read=authenticated, write=`settings.manage`) + `set_updated_at` trigger + Saudi-2026 seed (moon-sighting caveat).
- `supabase/migrations/20260626170000_workload_hours_classification.sql` — **new**: recreate `daily_employee_workload` with a utilization-based `workload_level` (security_invoker preserved).

### Central helper (A)+(D)
- `src/lib/workload/compute.ts` — `countWorkingDays`/`capacityHours`/`aggregateEmployeeWorkload` gain an optional `holidays` arg; new `levelForUtilization()` + `UTILIZATION_BAND` replace count-based `levelFor`.

### Data / actions (D + wiring)
- `src/lib/data/holidays.ts` — **new**: `listHolidays`, `listHolidayDates(from,to)`, create/update/delete.
- `src/lib/data/workload.ts` — `getWorkloadForRange` fetches holidays + passes them to the helper; **new** `getReassignableTasks()` (statuses where assign is legal).
- `src/lib/actions/assignee-workload.ts` — fetches holidays + passes them to the helper.
- `src/lib/validations/holidays.ts` + `src/lib/actions/holidays.ts` — **new**: holiday CRUD (gated by `settings.manage`).
- `src/types/database.types.ts` — `public_holidays` table type.

### UI
- `src/app/(app)/workload/page.tsx` — holiday-adjusted capacity label; renders the reassign board for `tasks.assign` holders.
- `src/components/workload/workload-table.tsx` — band labels/colors + cutoffs legend + per-row band cue (B).
- `src/components/workload/reassign-board.tsx` — **new** native-DnD board calling the existing assign action (C).
- `src/components/holidays/holidays-manager.tsx` + `src/app/(app)/admin/holidays/page.tsx` — **new** admin CRUD (D).
- `src/components/layout/nav-config.ts` — "Holidays" admin nav item (`settings.manage`).

### Tests
- `tests/unit/workload-compute.test.ts` — updated to hours-based bands + new holiday cases + NULL-effort case.
- `tests/unit/assignee-workload-action.test.ts` — mock updated for the holiday lookup.
- `tests/unit/reassign-action.test.ts` — **new**: assign-permission gate proof.

---

## 4. Central helper change + full caller list (no duplication)

| | Old signature | New signature |
|---|---|---|
| working days | `countWorkingDays(from, to)` | `countWorkingDays(from, to, holidays?)` |
| capacity | `capacityHours(from, to)` | `capacityHours(from, to, holidays?)` |
| aggregate | `aggregateEmployeeWorkload(tasks, from, to)` | `aggregateEmployeeWorkload(tasks, from, to, holidays?)` |
| classify | `levelFor(count)` (count-based) | `levelForUtilization(utilizationPct)` (hours-based) |

`holidays` is optional → omitting it preserves the original work-week-only
behavior. **All callers** of the helper (each now inherits the holiday
adjustment by passing the holiday set):

1. `src/lib/data/workload.ts` → `getWorkloadForRange` (Workload page rows) — fetches `listHolidayDates(from,to)`, passes to `aggregateEmployeeWorkload`.
2. `src/lib/actions/assignee-workload.ts` → `getAssigneeWorkloadAction` (create-task preview) — fetches holidays, passes them.
3. `src/app/(app)/workload/page.tsx` → `capacityHours(range, holidays)` (header capacity label).
4. Tests: `tests/unit/workload-compute.test.ts`, `tests/unit/assignee-workload-action.test.ts`.

The overdue-digest cron (previous PR) was checked — it does **not** use the
capacity helper (it has no capacity calculation), so there is nothing to inherit
there. There is exactly **one** capacity calculation in the codebase.

---

## 5. Thresholds, color bands, NULL-effort rule (all stated)

- **Utilization** = `total active estimated hours ÷ capacity hours`, where capacity
  = `8h × (Sun–Thu working days − public holidays in range)`.
- **Bands** (`UTILIZATION_BAND` in compute.ts — shared by the SQL view, the TS
  classifier, and the UI legend so they never drift):
  | Band | Utilization | Level | Color token | Label |
  |---|---|---|---|---|
  | Under capacity | `< 80%` | low | `--color-success` (green) | "Under capacity" |
  | Near capacity | `80–100%` | medium | `--color-warning` (amber) | "Near capacity" |
  | Over capacity | `> 100%` | high | `--color-danger` (red) | "Over capacity" |
  Color is always paired with the band label (pill), a colored left-border cue,
  and a legend stating the cutoffs — never color-only.
- **NULL effort:** a task with `estimated_effort_hours = NULL` contributes **0
  hours** (we never fabricate effort) but is **still counted** in
  `active_task_count`. Rationale: a fabricated default would distort utilization;
  the secondary count remains visible to flag estimate gaps. Applied consistently
  in `aggregateEmployeeWorkload` (`?? 0`) and the SQL view (`coalesce(...,0)`).

---

## 6. Holidays permission decision

**Reused the existing `settings.manage` key** (held by admin + section_head) for
holiday writes — the same key that gates `business_lines` and `app_settings`,
which holidays resemble (admin reference/config data). **No new permission key**
was added, so **no per-role totals change** (they remain as set by the prior PR:
admin 43 · section_head 41 · employee 15 · ceo 12). Read is open to all
authenticated users (`using (true)`) because capacity is shown to every workload
viewer and holiday dates are non-sensitive.

---

## 7. Seeded 2026 holidays

| Date | Name | Basis |
|---|---|---|
| 2026-02-22 | Founding Day | Fixed Gregorian |
| 2026-03-20 → 2026-03-23 | Eid al-Fitr (estimated) | **Moon-sighting estimate** |
| 2026-05-27 → 2026-05-30 | Eid al-Adha (estimated) | **Moon-sighting estimate** |
| 2026-09-23 | Saudi National Day | Fixed Gregorian |

10 rows total. The migration explicitly comments that the Hijri/Eid dates are
moon-sighting **estimates** and admin-editable — a starting point, not
authoritative; an admin should correct them once officially announced.

---

## 8. Gate A — actual output

```
npm run lint       → exit 0 (no errors)
npm run typecheck  → exit 0
npm run test       → Test Files 40 passed (40) · Tests 193 passed (193)
npm run build      → exit 0 ; new route: ├ ƒ /admin/holidays
```
**Dependencies:** none added. Drag uses native HTML5 DnD (no drag library).
`tailwind-merge` stays `^3.6.0` (3.x); `package.json`/lock unchanged.

Focused new/updated tests:
```
✓ aggregateEmployeeWorkload > levels derive from HOURS-vs-capacity utilization, not task count
✓ aggregateEmployeeWorkload > NULL effort contributes 0 hours but is still counted
✓ public holidays reduce working days / capacity > subtracts a holiday falling on a working day
✓ public holidays reduce working days / capacity > ignores a holiday on an already-off weekend day
✓ public holidays reduce working days / capacity > flows into utilization (holiday week vs normal week)
✓ drag-to-reassign > the assign action is gated by tasks.assign and requires an assignee
✓ drag-to-reassign > rejects a caller WITHOUT tasks.assign (same gate, no new path)
✓ drag-to-reassign > offers the assign affordance only to holders of tasks.assign
```

---

## 9. Gate B — PG16 replica proofs (actual output)

Fresh PostgreSQL **16.13** cluster; prod-only roles + `auth`/`storage` shims via
`CREATE … IF NOT EXISTS`; all migrations applied.

### Capacity math — holiday vs non-holiday week (central helper)
The helper is pure TS; its math is proven by unit test (run under Gate A), and
the replica proves the holiday-date **inputs** it receives:
```
-- central helper (unit test):
countWorkingDays('2026-06-14','2026-06-18')                 = 5   (normal week)
countWorkingDays('2026-06-14','2026-06-18', ['2026-06-16']) = 4   (holiday week)
aggregate 32h task → normal: capacity 40h, utilization 80%
                  →  holiday: capacity 32h, utilization 100%   (holiday raised it)
ignored: a holiday on Fri/Sat (already non-working) → no change
-- replica (holiday-date inputs):
Founding-Day week 2026-02-22..2026-02-26 → 1 holiday (Founding Day)
normal week       2026-06-14..2026-06-18 → 0 holidays
```
A non-holiday (normal) week is unchanged (5 working days / 40h).

### Effort-HOURS bands via `daily_employee_workload` (replica)
```
   full_name    | active_task_count | total_estimated_hours | utilization_pct | workload_level
----------------+-------------------+-----------------------+-----------------+----------------
 Emp Over       |                 1 |                 10.00 |           125.0 | high
 Emp Near       |                 1 |                  7.00 |            87.5 | medium
 Emp Under      |                 1 |                  4.00 |            50.0 | low
 Emp NullEffort |                 1 |                     0 |             0.0 | low
```
Bands derive from HOURS (10h→125%→high, 7h→87.5%→medium, 4h→50%→low). A NULL-effort
task → 0h but is still counted (count 1). "Emp Over" also has a `completed` 99h
task that is correctly **excluded** (count 1, not 2; terminal status).

### `public_holidays` RLS
```
2026 holiday rows seeded: 10
-- employee (no settings.manage):
 employee_can_read = 10
 DENIED employee INSERT: new row violates row-level security policy for table "public_holidays"
 employee_update_rows = 0
 employee_delete_rows = 0
-- admin (settings.manage):
 INSERT 0 1
 total_after_admin_insert = 11
```

### Reassign permission + assign guard (drag routes through the existing path)
Unit test: `transitionTaskAction(id,"assign",…)` returns `Not authorized.` for a
caller without `tasks.assign` (before any DB transition — guard/notifications
untouched); the assign affordance is offered only to `tasks.assign` holders.
Replica (the transition guard the drop hits):
```
LEGAL  approved -> assigned  : OK; assignee updated
BLOCKED in_progress -> assigned : Illegal task status transition: in_progress -> assigned
```
Only `approved`/`reopened`/`assigned` tasks are offered as drag sources
(`getReassignableTasks`), matching what the guard accepts; anything else
reverts + toasts.

### Lifecycle untouched
```
BLOCKED as expected: Illegal task status transition: draft -> completed
```
A legal transition still passes and an illegal one still raises — the
`validate_task_transition` guard is unchanged (no lifecycle file modified).

---

## 10. Assumptions / decisions, out-of-scope, manual ops

**Assumptions / decisions**
- **No manager→report mapping exists** (no `manager_id`/`reports_to`; only
  `profiles.department_id`). The workload surface already scopes by the tasks
  SELECT RLS (`tasks.read_all` = org-wide for managers); this PR did not change
  that scoping. The reassign board lists the RLS-visible reassignable tasks.
- **NULL effort → 0h, still counted** (§5).
- **Reassign reuses `transitionTaskAction('assign')`** verbatim — so only tasks in
  `approved`/`reopened`/`assigned` are draggable (the guard rejects others). Drag
  is a trigger only; native HTML5 DnD (no dep). The task action bar's Assign
  control remains the keyboard-accessible path.
- **`settings.manage` reused** for holidays (no new permission key) — §6.
- The single-day operational view (`daily_employee_workload`, used by the
  dashboard widget) computes utilization against an 8h day and does not subtract
  holidays (a single day is either a holiday or not); the range-scoped Workload
  page applies the holiday-aware central helper.

**Out of scope (future):** per-person leave/PTO calendars; partial-day capacity;
skills-based / auto-assignment; multi-year holiday auto-generation; drag for
anything other than reassignment.

**Manual ops:** **none** beyond merging + the normal `supabase db push` (applies
both migrations and seeds the 2026 holidays). One operational note: an admin
should **correct the Eid dates** via the Holidays admin page once the Saudi
authorities officially announce them (they are moon-sighting estimates).
Confirmed: **no RLS broadening** beyond the new `public_holidays` policies, **no
lifecycle change**, and **no new storage/service-role surface**.
