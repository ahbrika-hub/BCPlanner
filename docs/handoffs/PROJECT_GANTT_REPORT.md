# Project Gantt / Timeline — Implementation Report

A read-only, per-project Gantt/timeline on the project detail page: the project's
tasks as horizontal bars on a day-scaled axis, with dependency arrows drawn from
the existing `task_dependencies` data. Pure view layer over existing data.

---

## 1. Branch + first-action confirmation

- **First action (before any file edit):** created branch `feat/project-gantt`
  off current `main` (`8e20658` — "Merge pull request #84 …"). No file was
  touched until the branch existed.
- Feature branch → PR to `main`. Never pushed to `main`. One coherent change set.

```bash
$ git checkout -b feat/project-gantt     # from main @ 8e20658
Switched to a new branch 'feat/project-gantt'
```

---

## 2. Summary

A **Timeline** card on `/projects/[id]` renders each in-scope project task as a
bar positioned by `start_date → due_date` on a shared time axis (month
gridlines), with restrained dependency arrows (blocker → blocked) for
dependencies whose **both** ends are in the project. Clicking a bar opens the task
via the existing modal intercept. The chart is horizontally scrollable with a
fixed task-label column and a legend. **Read-only** — no drag, no date/dependency
editing, no writes of any kind.

> **No new migration.** The view reads existing `tasks` + `task_dependencies`
> only. `validate_task_transition`, `generate_task_no`, and all
> dependency/lifecycle logic are untouched. RLS is not broadened.

---

## 3. Files changed / added

### Added
| File | Purpose |
|------|---------|
| `src/lib/tasks/gantt.ts` | Pure `buildGantt(tasks, deps, todayStr)` — bar geometry, month gridlines, arrows, unscheduled list, external-blocker flags. |
| `src/lib/data/gantt.ts` | `getProjectGanttData(projectId)` — RLS-scoped read of project tasks + dependency rows touching them. |
| `src/components/projects/project-gantt.tsx` | Client renderer: scrollable SVG/CSS bar layout, arrows, legend, unscheduled area. |
| `tests/unit/gantt.test.ts` | Date-completeness, arrow scope, external-blocker, window/ordering. |

### Modified
| File | Change |
|------|--------|
| `src/app/(app)/projects/[id]/page.tsx` | Fetch `getProjectGanttData` and render the `<ProjectGantt>` Timeline card. |

No dependency added; `tailwind-merge` stays `^3.6.0`.

---

## 4. Rendering approach + dependency justification

**Custom absolute-positioned bars (CSS) + a thin SVG overlay for arrows — no
charting library.** Recharts (present, `^3.8.0`) is built for axis charts, not
Gantt bars with cross-row dependency connectors; a custom layout is lighter and
gives exact control over bar/arrow geometry. The geometry is computed in the pure
`buildGantt` helper (day-indexed math, `PX_PER_DAY = 28`); the component only
positions DOM/SVG from it. Arrows are a single `<path>` per dependency (a gentle
cubic from the blocker's right edge to the blocked task's left edge) with one
shared arrowhead `<marker>`, styled muted/thin to stay readable. **No new npm
dependency.**

Accessibility / not-color-only: bars carry the `task_no` text label, an overdue
`AlertTriangle` icon, a single-date `CircleDot` marker icon, and an external-
blocker `Link2` icon; status is the left-border color **and** is shown via the
legend + the task's status badge in the Unscheduled list.

---

## 5. Date-completeness rules (as implemented)

| Task dates | Render |
|------------|--------|
| **start + due** | A full bar spanning `[start, due]` (inclusive day width). |
| **only one** (start *or* due) | A **single-day marker** at the known date (one-day-wide bar with a `CircleDot` icon). |
| **neither** | **Not dropped** — listed in an **"Unscheduled"** area below the chart (task_no + title + status, links to the task). |

If `due < start` the span is normalized to `[min, max]`. Overdue bars (canonical
rule, vs the injected reference date) get a danger border + icon.

---

## 6. Dependency-arrow scope + external-end handling

- An **internal arrow** (blocker → blocked) is drawn only when **both** ends are
  in this project's visible task set **and both are scheduled** (an arrow needs
  two positioned bars). A dependency touching an **unscheduled** in-project task
  is not drawn (no coordinates) — that task still shows in Unscheduled.
- **External end:** for a dependency whose other end is **outside** this project's
  task set, no off-chart arrow is drawn; instead the in-project **blocked** task's
  bar is flagged with a subtle **"external blocker"** `Link2` icon. No external
  task detail is rendered.
- **No leak:** `task_dependencies` RLS only returns a row when the caller can see
  **both** ends, so a dependency to a task the caller can't see never reaches the
  client at all (proven in §9).

---

## 7. Permission gate reused

The Timeline lives on `/projects/[id]`, which already gates on
**`tasks.read_all`** ({admin, section_head, ceo}). No new permission key. Both
data reads run under the caller's session client, so RLS scopes tasks and
dependencies to exactly what the viewer may see.

---

## 8. Gate A — actual output

```text
$ npm run lint        → exit 0 (no errors)
$ npm run typecheck   → exit 0 (tsc --noEmit)
$ npm run test        → Test Files 48 passed (48) · Tests 251 passed (251)
$ npm run build       → ✓ Compiled successfully; /projects/[id] built; exit 0
```

**Dependencies:** none added. `tailwind-merge` stays `^3.6.0` (3.x).

New tests:
```text
✓ buildGantt — date completeness > (a) both dates → a full bar spanning the range
✓ buildGantt — date completeness > (b) only one date → a minimum-width single-day marker
✓ buildGantt — date completeness > (c) neither date → listed in Unscheduled, NOT dropped
✓ buildGantt — date completeness > marks an overdue bar via the canonical rule
✓ buildGantt — dependency arrows > draws an arrow blocker → blocked when both are in-project and scheduled
✓ buildGantt — dependency arrows > does NOT draw an arrow when an endpoint is unscheduled
✓ buildGantt — dependency arrows > external blocker (out-of-project end) → flags the in-project task, draws no off-chart arrow
✓ buildGantt — dependency arrows > an in-project task with no external dep is not flagged
✓ buildGantt — window + ordering > orders rows by start date and produces month gridlines
✓ buildGantt — window + ordering > falls back to a today-centered window when nothing is scheduled
```

---

## 9. Gate B — behavioral proofs

Fresh PostgreSQL **16.13** cluster; prod-only `auth`/`storage` shimmed; **all 43**
migration files applied — **no new migration in this PR**.

### Read-only (how verified)
The entire Gantt code path contains no mutation:
```text
$ grep -rnE "\.insert\(|\.update\(|\.delete\(|\.upsert\(|\.rpc\(|use server|transitionTaskAction|addUpdate" \
    src/lib/data/gantt.ts src/lib/tasks/gantt.ts src/components/projects/project-gantt.tsx
NONE — read-only confirmed
```
`getProjectGanttData` issues only `.select(...)`; `buildGantt` is pure; the
component renders links only. No server action, no `"use server"`.

### Date handling — the project query returns (a)/(b)/(c), none dropped
```text
     task_no      | start_date |  due_date
------------------+------------+------------
 TSS-BC-2026-0001 | 2026-06-10 | 2026-06-14   (a) both → full bar
 TSS-BC-2026-0002 |            | 2026-06-20   (b) due-only → single-day marker
 TSS-BC-2026-0003 |            |              (c) neither → Unscheduled
```
(The classification itself is the pure `buildGantt`, proven in §8.)

### RLS — the bars query is visibility-scoped (a task you can't see → no bar)
```text
As ADMIN (tasks.read_all): admin_p1_tasks = 5        (sees all project tasks)
As EVE   (employee):       eve_p1_visible_tasks = 1   (only her own — TSS-BC-2026-0005)
```

### Dependency arrows + external / invisible handling
```text
As ADMIN — deps touching P1 tasks:
 blocked          | blocker          | both_in_project
 TSS-BC-2026-0001 | TSS-BC-2026-0006 | f   → external blocker flag (no off-chart arrow)
 TSS-BC-2026-0002 | TSS-BC-2026-0001 | t   → internal arrow drawn
 TSS-BC-2026-0005 | TSS-BC-2026-0004 | t   → internal arrow drawn

As EVE — dependency whose other end (Bob-owned) she can't see:
 eve_visible_deps_for_her_task = 0   → row hidden by RLS (needs BOTH ends visible) — no leak
```

### Lifecycle / data untouched
```text
$ git diff main -- supabase/migrations/20260606141054_tasks_core.sql
(no output — validate_task_transition unchanged)

$ git status --short supabase/migrations/
(no output — no migration added)
```

---

## 10. Assumptions / decisions, out-of-scope, manual ops

**Decisions**
- Custom CSS/SVG render, no charting dep (§4).
- Single-date tasks → one-day marker; no-date tasks → Unscheduled (§5).
- Arrows only between two scheduled in-project bars; external ends → a flag, not
  an off-chart arrow; invisible ends never reach the client (§6).
- Reuses the page's `tasks.read_all` gate; both reads RLS-scoped (§7).
- Default window = min start … max due across scheduled tasks (padded), or a
  today-centered window when nothing is scheduled. Fixed day scale (28px/day),
  horizontally scrollable.

**Out of scope (deferred, noted as future)**
- Drag-to-reschedule (editing dates from the chart); creating/editing
  dependencies from the chart; an all-tasks / cross-project global Gantt;
  critical-path computation; zoom levels beyond the default; baselines.

**Manual ops:** **none** beyond the normal merge. No migration, no storage
change, no service-role usage, no new permission key, no RLS change.
