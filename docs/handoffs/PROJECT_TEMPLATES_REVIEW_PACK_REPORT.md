# Project Templates + Weekly Management-Review Pack — Completion Report

Two additive Phase-3 features: (A) admin-defined **project templates** that
auto-generate a standard task set on project creation via the EXISTING
task-creation path, and (B) a **weekly management-review pack** that composes the
existing exec KPIs + delayed-tasks report + workload heatmap on one screen,
reusing their queries (recomputing nothing). The task approval/transition
lifecycle was **not** touched; no service-role path; no RLS broadened beyond the
new tables' own policies.

---

## 1. Branch

**`feat/project-templates-review-pack`** — created off `main` as the **first
action**, before any file was modified. Feature branch → PR to `main`; `main` is
never pushed to.

---

## 2. Summary

- **(A) Project templates** — `/admin/project-templates` admin CRUD (mirrors
  `/admin/templates`) defines a template (name/description) + an ordered list of
  task definitions (title, description, priority, business line, est. hours). On
  `/admin/projects`, "New from template" creates the project (existing
  `createProjectAction`) then generates each task via the existing
  `createTaskAction` with `task_category='project'` + the new `project_id` — so
  every task gets a real `TSS-BC-YYYY-NNNN` number, a role-correct starting
  status, and passes the transition guard. No raw bulk insert.
- **(B) Management-review pack** — `/management-review`, gated to CEO +
  section_head + admin via `reports.read_all`. Composes, on one read-only screen
  with an "as of" timestamp per section: the exec/operational KPIs
  (`getDashboardStats`), the delayed-tasks breakdown (`getDelayedReport`), and the
  workload bands (`getWorkloadForRange` + `WorkloadTable`) — each from the SAME
  helper the live page uses, recomputing nothing.

---

## 3. Files changed / added

### Migration
- `supabase/migrations/20260626180000_project_templates.sql` — **new** `project_templates` + child `project_template_tasks` tables, `set_updated_at` triggers, RLS (read `projects.read`, write `projects.manage`).

### (A) Project templates
- `src/types/database.types.ts` — `project_templates` + `project_template_tasks` types.
- `src/lib/data/project-templates.ts` — **new** list/get/create/update/delete + `setTemplateTasks`.
- `src/lib/validations/project-templates.ts` — **new** template + task-def + create-from-template schemas.
- `src/lib/actions/project-templates.ts` — **new** CRUD actions + `createProjectFromTemplateAction` (orchestrates the existing actions).
- `src/components/project-templates/project-templates-manager.tsx` — **new** admin manager (dynamic task list via `useFieldArray`).
- `src/app/(app)/admin/project-templates/page.tsx` — **new** admin page (`projects.manage`).
- `src/components/projects/create-project-from-template.tsx` — **new** "New from template" dialog.
- `src/app/(app)/admin/projects/page.tsx` — render the "New from template" action.
- `src/components/layout/nav-config.ts` — "Project Templates" nav (`projects.manage`).

### (B) Review pack
- `src/lib/data/review-pack.ts` — **new** `getReviewPackData()` shared loader + `REVIEW_PACK_PERMISSION`.
- `src/app/(app)/management-review/page.tsx` — **new** composed page (`reports.read_all`).
- `src/components/layout/nav-config.ts` — "Management Review" nav under Insight (`reports.read_all`).

### Tests
- `tests/unit/project-template-generation.test.ts` — generation-reuse + gate + partial-failure.
- `tests/unit/review-pack.test.ts` — no-recompute delegation + role-gate constant.

---

## 4. Project-template data model + permission gates

**Data model — a child TABLE (`project_template_tasks`), not jsonb.** A template
has a one-to-many set of task defs, each reusing the same default-field shape as
`task_templates` (title, description, priority, business_line_id,
estimated_effort_hours). A relational child table gives a real FK to
`business_lines`, per-row validation, and a stable `position` ordering — none of
which a jsonb blob offers. (`task_templates` stores a single def as flat columns;
there is no existing one-to-many template precedent, so the relational shape is
the natural extension.)

**Permission gates — reuse the EXISTING projects gates (no new key):**
- **Read** via `projects.read` (all roles) — consistent with the projects /
  task_templates reference tables.
- **Write** via `projects.manage` (admin + section_head).

Project templates belong to the projects module (they produce project tasks and
sit beside projects in admin), so they inherit its gates. **No new permission
key → no per-role totals change.**

---

## 5. Proof-of-reuse for generation

`createProjectFromTemplateAction` (`src/lib/actions/project-templates.ts`):
1. `ensureManager()` → `projects.manage`.
2. loads the template (RLS `projects.read`).
3. **`createProjectAction({ name, business_line_id })`** — the existing project action → `projectId`.
4. for each task def: **`createTaskAction({ ...def, task_category: 'project', project_id })`** — the existing task action, which sets the role-correct status, fires `generate_task_no` (real `TSS-BC` number), and is subject to `tasks.create` RLS + the transition guard.

No `tasks` insert occurs in this feature's own code — generation is entirely the
two existing actions. Partial failures are surfaced (project id + created count +
failed titles), never hidden. Unit test `project-template-generation.test.ts`
asserts `createProjectAction` is called once and `createTaskAction` once per def
with the project link.

---

## 6. Review-pack reused sources + shared helper

| Section | Reused source (unchanged) | Component |
|---|---|---|
| KPIs | `getDashboardStats()` — `src/lib/data/analytics.ts` (the exec/operational dashboard source) | `KpiCard` |
| Delayed tasks | `getDelayedReport()` — `src/lib/data/delayed.ts` (the `/reports/delayed` source; canonical overdue rule) | `KpiCard` + table |
| Workload | `getWorkloadForRange()` — `src/lib/data/workload.ts` (the `/workload` source; holiday-aware capacity) | `WorkloadTable` |

A thin shared loader `getReviewPackData(asOf)` (`src/lib/data/review-pack.ts`)
calls those three helpers and returns their output unchanged (plus the resolved
week range + timestamp). **No query is re-derived and no logic is forked** — the
live pages keep calling the same helpers directly; the pack calls them through
the loader. Proven by `review-pack.test.ts` (the loader returns the exact helper
objects by identity).

---

## 7. Review-pack role gate

**`reports.read_all`** — held by exactly **ceo + section_head + admin** (employee
holds only `reports.read`). It is the same gate the live delayed-tasks report
already uses, so the pack's access matches its strongest section. No new
permission key. (Gate B confirms the role membership on the replica.)

---

## 8. Gate A — actual output

```
npm run lint       → exit 0 (no errors)
npm run typecheck  → exit 0
npm run test       → Test Files 42 passed (42) · Tests 199 passed (199)
npm run build      → exit 0 ; new routes:
                       ├ ƒ /admin/project-templates
                       ├ ƒ /management-review
```
**Dependencies:** none added (`useFieldArray` ships with the existing
react-hook-form). `tailwind-merge` stays `^3.6.0` (3.x); `package.json` unchanged.

New tests (verbose):
```
✓ getReviewPackData > delegates to the live helpers and passes their output through unchanged
✓ getReviewPackData > gates on reports.read_all (ceo + section_head + admin; excludes employee)
✓ createProjectFromTemplateAction > creates the project once and generates exactly N tasks via createTaskAction
✓ createProjectFromTemplateAction > is denied without projects.manage (no project, no tasks created)
✓ createProjectFromTemplateAction > reports partial failure without hiding the half-built project
```

---

## 9. Gate B — PG16 replica proofs (actual output)

Fresh PostgreSQL **16.13** cluster; prod-only roles + `auth`/`storage` shims via
`CREATE … IF NOT EXISTS`; all migrations applied.

### Tables + RLS present
```
        relname         | rls
------------------------+-----
 project_template_tasks | t
 project_templates      | t
```

### A — template generation through the real creation path
A template with 3 task defs → create project → one task inserted per def exactly
as `createTask()` does (`task_category='project'` + `project_id` + role status);
`set_task_no` fires per row:
```
     task_no      |       title       | task_category |              project_id              |  status
------------------+-------------------+---------------+--------------------------------------+----------
 TSS-BC-2026-0001 | Kickoff meeting   | project       | 3c000000-0000-4000-8000-000000000001 | assigned
 TSS-BC-2026-0002 | Set up repo       | project       | 3c000000-0000-4000-8000-000000000001 | assigned
 TSS-BC-2026-0003 | Define milestones | project       | 3c000000-0000-4000-8000-000000000001 | assigned
generated_tasks = 3
```
Exactly N=3 tasks, each with a valid `TSS-BC-YYYY-NNNN` number, `task_category='project'`,
the correct `project_id`, and a guard-legal starting status — i.e. the real path,
not a bulk insert. (The TS orchestration calling `createTaskAction` per def is
proven by the Gate-A unit test.)

### Templates RLS (write = projects.manage)
```
-- employee (projects.read, NOT projects.manage):
 employee_can_read = 1
 DENIED employee INSERT: new row violates row-level security policy for table "project_templates"
-- section_head (projects.manage):
 inserted SH template   (INSERT 0 1)
```

### Review-pack role gate
```
reports.read_all is held by:
     role
--------------
 admin
 section_head
 ceo
```
Employee is absent → the pack is denied to employees and allowed to
ceo/section_head/admin. (Equality of the pack figures with the live sources is
proven by the `review-pack.test.ts` identity assertions — same helper objects.)

### Lifecycle untouched + generate_task_no still sequential
```
next task after generation → TSS-BC-2026-0004      (sequential, generate_task_no intact)
legal  draft -> pending_approval : legal OK: pending_approval
illegal draft -> completed       : BLOCKED as expected: Illegal task status transition: draft -> completed
```

---

## 10. Assumptions / decisions, out-of-scope, manual ops

**Assumptions / decisions**
- Child table over jsonb for task defs (§4).
- Reused `projects.read` / `projects.manage` (no new key) for templates; `reports.read_all` for the pack (§4, §7).
- **Generation atomicity:** the brief forbids a bulk-insert / service-role path, so the project + N tasks are created through separate action calls (separate transactions), not one DB transaction. Inputs are validated up front; on a per-task failure the action returns `ok:false` with the project id and created count, surfacing a partial build rather than leaving it silent. Full cross-row atomicity would require the forbidden raw path.
- Generated tasks inherit the normal creation behavior: the app audits task **status changes** (not inserts), so generated tasks behave identically to manually-created ones — no special audit path was added.
- The single-day dashboard widget and the pack both read the same helpers; the pack uses the range-aware `getWorkloadForRange` for the current work-week.

**Out of scope (future):** intake/request form (employees use Create Task);
request topics; bulk-editing generated tasks; scheduling/exporting the review
pack; multi-week trends beyond what the existing sources already provide.

**Manual ops:** **none** beyond merging + the normal `supabase db push` (applies
the one new migration). Confirmed: **no storage or service-role change**, no
lifecycle change, and no RLS broadened beyond the two new tables' own policies.
