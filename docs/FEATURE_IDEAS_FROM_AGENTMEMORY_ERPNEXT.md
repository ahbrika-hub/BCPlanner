# Feature & Tool Ideas from `agentmemory` + `erpnext`

**Type:** Read-only analysis · **Date:** 2026-06-07 · **Author:** feature-analysis pass
**Scope:** Concept extraction only. Nothing implemented, installed, built, or executed.

> **What this is.** A catalogue of feature/UX/performance *ideas* mined from two external
> repositories — [`ahbrika-hub/agentmemory`](https://github.com/ahbrika-hub/agentmemory) and
> [`ahbrika-hub/erpnext`](https://github.com/ahbrika-hub/erpnext) — re-expressed so they map
> natively onto the TSS Planner stack. These are **options for the owner to decide on**, not a
> roadmap to auto-build. Every item is tagged for fit against the **locked product decisions**.

> **Locked product decisions this doc respects** (from `docs/DECISIONS.md`, `docs/SYSTEM_STATE.md`,
> `docs/IMPROVEMENT_ROADMAP.md`):
> 4 roles (`admin` / `section_head` / `employee` / `ceo`) · 12 task statuses (`draft`,
> `pending_approval`, `approved`, `assigned`, `in_progress`, `pending_update`, `pending_review`,
> `completed`, `rejected`, `returned_for_modification`, `cancelled`, `reopened`) · single
> **Business Consulting** department · task-no format `TSS-BC-YYYY-NNNN` · the **40/30/30**
> performance formula `(completed/total)*40 + (qualityAvg/5)*30 + (1 − delayed/total)*30` ·
> the Supabase RLS model (15 RLS tables, `authorize()` / `get_my_permissions()` RBAC).

> **Target stack** every recommendation maps onto: Next.js **16** App Router, React **19**,
> TypeScript strict, Tailwind **v4** (`@theme`), shadcn/ui (New York), Supabase Postgres + RLS,
> RSC + server actions, recharts, Zod 4, react-hook-form. Hosted on Vercel.

---

## Confirmations / gates

- ✅ **No change to either analyzed repo.** Both were read locally only; no build/install/execute.
- ✅ **No BCPlanner source/config/migration/dependency change.** The diff is **exactly one new
  file**: this document. No `package.json`, migration, or component was touched.
- ✅ **Every recommendation is tagged** `FITS` (within locked scope), `NEEDS PRODUCT DECISION`, or
  `CONFLICTS`. Scope-expanding items are quarantined in their own sections and are **not** in the
  shortlist.
- ✅ **Licensing respected.** ERPNext is GPLv3; **only concepts/patterns** were extracted — no
  ERPNext source is copied into BCPlanner. See the licensing note at the bottom.
- ⚠️ **Sampling note (erpnext).** ERPNext is a large Frappe monolith (40+ modules). It was **not**
  read whole. Sampling targeted the task/project-relevant surface: `erpnext/projects/*` (Task,
  Project, dependencies, templates, project-update digest, reports, dashboards/number-cards). Many
  deeper UX features ERPNext users see — Kanban board, Gantt, list-view saved filters / bulk
  edit / inline edit, document version history & activity timeline, comments + @mentions,
  notification inbox, auto-repeat (recurring documents), assignment rules, SLA/escalation — live in
  the **Frappe framework**, not this repo. Those are extracted **conceptually** from how ERPNext's
  project module leans on them, and flagged as such; the framework code itself was not in scope.
- ⚠️ **Sampling note (agentmemory).** Fully accessible and read at the doc/architecture/MCP level
  (README, ROADMAP, `src/mcp/*`, hooks). **Correction to the brief:** it is **not a Python
  library** — it is a **TypeScript / npm** package (`@agentmemory/agentmemory`) built on the `iii`
  engine, exposing memory over **MCP + REST** (53 MCP tools, hooks for 50+ agents). See Step 0.

---

## Step 0 — What each repo actually is

### `agentmemory`
- **What it is:** persistent, cross-session **memory engine for AI coding agents** (Claude Code,
  Cursor, Codex, OpenCode, …). Captures session observations via lifecycle hooks, stores them with
  a 4-tier memory lifecycle (episodic → semantic, decay on an Ebbinghaus curve, auto-forget,
  contradiction resolution), and serves recall via **hybrid search** (BM25 + vector embeddings +
  knowledge graph). Confidence scoring, SHA-256 dedup, local embeddings (`all-MiniLM-L6-v2`).
- **Stack / maturity:** TypeScript, npm-published, MCP + REST + `iii` functions, real-time viewer,
  CI, benchmarks, public 12-month roadmap, governance docs. Mature and actively developed.
- **Best treated as:** **primarily a CLAUDE-CODE / dev-time WORKFLOW tool** (same category as
  `claude-mem`) — useful to *the team building TSS Planner*, not a feature of the product itself.
  A **secondary, conceptual** value exists as inspiration for the roadmap's Tier-4 *"AI-assisted
  task planning"* vision (analogy only — adopting an agent-memory engine inside TSS Planner is
  **not** recommended). Honest assessment: **mostly workflow tooling; low direct in-app relevance.**

### `erpnext`
- **What it is:** a large open-source **ERP** built on the **Frappe** framework (Python + a JS
  desk UI). Relevant slice for us: the **Projects** module — `Task`, `Project`, task dependencies,
  project templates, timesheets, a daily **Project Update** digest, and several project reports /
  dashboard number-cards.
- **Stack / maturity:** Frappe/Python ERP, GPLv3, very mature, huge. **Different stack from TSS
  Planner** — extraction is conceptual only; never adopt the stack or copy code.
- **Best treated as:** an **APP-FEATURE source** for task-management and list/dashboard UX
  patterns — a mature reference for "what a task system grows into." Extract the *data-model and UX
  ideas*; reimplement natively on Next/Supabase.

---

## ⭐ Shortlist — highest value-to-effort, FITS within locked scope

Ranked. Each fits the 4 roles / 12 statuses / single department / RLS model as-is. Several
**reinforce items already on the TSS Planner roadmap** (noted) — included because the two source
repos independently validate them as high-value.

| # | Idea | Source | Goal | Effort | Why it wins | Roadmap overlap |
|---|------|--------|------|--------|-------------|-----------------|
| 1 | **Auto-derived "Overdue" indicator** (computed, not a new status) | erpnext | Task mgmt / Experience | **S** | ERPNext surfaces overdue work as a *derived* signal off `due_date` vs today — no extra status. We can render an "Overdue" badge/filter from existing `due_date` + status without touching the 12-status enum. Pure UI/query. | New (complements T2.4) |
| 2 | **List-view saved filters + multi-select status filter** | erpnext | Experience / Performance | **S–M** | ERPNext's list view is filter-first with saved views. The data layer already supports `status: TaskStatus[]` → `.in('status', …)`; T2.4 covers multi-select. Add URL-param-encoded saved filters on top. | Extends **T2.4** |
| 3 | **Full-text task search (Postgres `tsvector` + GIN)** | erpnext | Task mgmt / Performance | **M** | ERPNext leans on global search constantly. Maps cleanly to a generated `tsvector` column + GIN index migration, RLS preserved. | Matches **T2.9** |
| 4 | **Bulk actions on task/approval queues** | erpnext | Task mgmt / Performance | **M** | ERPNext desk supports bulk edit/assign/close. Section heads process queues; batched server action must re-check `can()` + `validate_task_transition` per row. | Matches **T2.8** |
| 5 | **Delayed-tasks report (delay = completed_at − due_date)** | erpnext | Task mgmt / Performance | **S–M** | ERPNext's `delayed_tasks_summary` computes per-task delay days + a chart. We already compute "delayed" for the 40/30/30 timeliness term — surface it as a report + recharts view. Reuses existing data. | Extends P5 reports / **T3 analytics** |
| 6 | **Activity timeline / version history per task** | erpnext (Frappe concept) | Experience / Task mgmt | **M** | Frappe shows a per-document timeline (status changes, comments, edits). We **already log status changes** (`log_task_status_change` trigger → `audit_logs`) and have `task_updates`/`task_comments` — assemble them into one chronological timeline tab on `/tasks/[id]`. Mostly read-side composition. | New |
| 7 | **Real-time notification bell (Supabase Realtime)** | erpnext (inbox concept) | Experience | **M** | ERPNext has a live notification inbox; the bell badge here only updates on navigation. Subscribe to `notifications` over Realtime, RLS-scoped. | Matches **T2.1** |
| 8 | **Task templates (pre-filled task definitions)** | erpnext | Task mgmt | **M** | ERPNext `Project Template` / `Project Template Task` let users stamp out standard task sets. A lightweight, single-task "template" (title/description/category/priority/effort presets) fits without new roles or statuses. | New (relates to recurring-tasks module) |

> **Suggested sequencing:** #1 → #2 (cheap, high-visibility) → #5/#6 (reuse existing data) →
> #3/#4/#7 (the M-sized engagement wins) → #8. None require new roles, new statuses, a second
> department, or new third-party dependencies (Realtime and `tsvector` are already in the Supabase
> platform).

---

## Step 1 — Grouped candidate tables

Columns: **Name** · **Source** · **What it is / how that repo does it** · **Native mapping
(Next/Supabase)** · **Goal(s)** · **Fit** · **Effort** · **Risks / new data / new RLS / new deps**.

### A. Task-management features

| Name | Source | What it is / how they do it | Native mapping | Goal | Fit | Effort | Risks / data / RLS / deps |
|------|--------|------------------------------|----------------|------|-----|--------|----------------------------|
| Auto "Overdue" signal | erpnext | ERPNext exposes an `Overdue` status auto-set from dates; the *concept* is a derived flag, not manual. | Compute in query/RSC from `due_date < today AND status NOT IN (completed,cancelled,…)`. Badge + filter only. | Task mgmt, Exp | **FITS** | S | No schema change. Do **not** add a 13th status — keep it derived. |
| Full-text search | erpnext | Global desk search across documents. | `tsvector` generated column on `tasks(title, description)` + GIN index migration; search input → `.textSearch()`. | Task mgmt, Perf | **FITS** (= T2.9) | M | New column + index migration; keep RLS. Arabic tokenisation deferred (Tier-3 RTL). No new dep. |
| Bulk actions | erpnext | Desk bulk edit/assign/close on list selections. | Multi-select in `/tasks` & `/approvals`; one batched server action re-running `can()` + transition guard per task; partial-failure UX. | Task mgmt, Perf | **FITS** (= T2.8) | M–L | Must not bypass `validate_task_transition`. No new dep. |
| Task templates | erpnext | `Project Template` + `Project Template Task` stamp standard task sets, incl. dependency mapping. | New `task_templates` table (title/desc/category/priority/effort) + "New from template" in the create dialog. RLS: same model as `tasks`. | Task mgmt | **FITS** (single-task scope) | M | New table + RLS policies. Keep it single-task to avoid project-hierarchy scope creep. |
| Delayed-tasks report | erpnext | `delayed_tasks_summary` report: delay days + chart. | New report page reusing existing "delayed" logic; recharts bar/line; CSV reuse. | Task mgmt, Perf | **FITS** | S–M | Read-only; reuses existing data. |
| Activity timeline / version history | erpnext / Frappe | Per-document timeline of edits, status changes, comments. | Merge `audit_logs` (status changes already logged) + `task_updates` + `task_comments` into one timeline tab. | Task mgmt, Exp | **FITS** | M | Read-side composition; ensure audit rows are RLS-readable to the viewer. No new data needed. |
| Task weight / progress % | erpnext | `task_weight` + `% progress`; project completion rolls up via Manual / Task-Completion / Task-Progress / Task-Weight methods. | We already capture `progress` via `task_updates`. Optional `task_weight` column for weighted dept rollups. | Task mgmt, Perf | **NEEDS PRODUCT DECISION** | M | New column; risk of overlapping/confusing the **locked 40/30/30** score. Decide whether weighting belongs anywhere near performance. |
| Task dependencies / blocking | erpnext | `Task Depends On` child table; `check_recursion` prevents circular refs; `reschedule_dependent_tasks` auto-shifts successor dates when a predecessor's end date moves. | Self-referential `task_dependencies(task_id, depends_on_id)` + cycle-check function + optional auto-reschedule. | Task mgmt | **NEEDS PRODUCT DECISION** (already Tier-3) | L | New table + new RLS + cycle prevention; meaningful complexity. Matches roadmap **Tier 3**. |
| Milestones | erpnext | `is_milestone` flag on tasks. | Boolean `is_milestone` column + badge/filter. | Task mgmt, Exp | **NEEDS PRODUCT DECISION** | S | Tiny, but adds a product concept; confirm it's wanted before adding schema. |
| Parent/sub-tasks (groups) | erpnext | `parent_task` + nested-set (`lft/rgt`) task grouping. | `parent_task_id` self-reference + tree UI. | Task mgmt | **NEEDS PRODUCT DECISION** | L | New hierarchy concept + RLS implications; potential scope expansion. |
| Daily status digest | erpnext | `Project Update` doctype: a dated digest of progress, with a `sent` flag, emailed out. | A scheduled (cron) per-section digest reusing the existing email + cron infra; `sent`-style idempotency. | Task mgmt, Exp | **NEEDS PRODUCT DECISION** | M | Reuses Resend + cron, but defines a new comms cadence — confirm desired. |
| SLA / escalation | erpnext / Frappe | SLA timers + escalation on overdue. | Cron + rules engine on `due_date`/status → notify/escalate. | Task mgmt, Perf | **NEEDS PRODUCT DECISION** (Tier-3 "SLA tracking") | L | New rules data + RLS; needs role/escalation-path decisions. |

### B. Experience / UX patterns

> All respect the locked design language: corporate/restrained, shadcn/ui (New York), brand tokens
> (TSS Burgundy `#762651` / SAPTCO Navy `#193560`), no gradients/heavy decoration.

| Name | Source | What it is / how they do it | Native mapping | Goal | Fit | Effort | Risks / deps |
|------|--------|------------------------------|----------------|------|-----|--------|--------------|
| Saved filters / views | erpnext | List view saves named filter sets per user. | URL-param-encoded filters (search-params, no new dep) → optional per-user saved views in `app_settings`/prefs. | Exp, Perf | **FITS** | S–M | If persisted, small prefs storage + RLS. Honour D10 nuqs caution (use native `searchParams`). |
| Multi-select status filter | erpnext | Filter list by several statuses at once. | Swap single `Select` for shadcn multi-select popover; parse array/CSV. | Exp | **FITS** (= T2.4) | S | UI-only, no DB change. |
| Inline edit in list | erpnext | Edit a field directly in the list row. | Inline `<Input>`/`<Select>` cells calling `updateTaskAction`; optimistic UI. | Exp, Perf | **FITS** | M | Re-check `can()` per edit; keep transition guard authoritative. |
| Activity timeline tab | erpnext/Frappe | Chronological per-doc timeline. | See Group A (audit + updates + comments). | Exp | **FITS** | M | Read-side only. |
| Notification inbox polish | erpnext | Dedicated inbox with read/unread, grouping, mark-all. | Already have `/notifications` + bell; add grouping/filtering and Realtime (T2.1). | Exp | **FITS** | S–M | Additive. |
| Loading skeletons | (general best practice; ERPNext desk shows progressive loading) | — | `loading.tsx`/Suspense per route; the installed `skeleton` is unused. | Exp, Perf | **FITS** (= T2.5) | M | Pairs with auth `cache()` (T1.5). |
| Kanban board view | erpnext / Frappe | Drag-and-drop board grouped by status. | A board view over the 12 statuses; column-drop = `transitionTaskAction` (must obey the guard, so not all drops are legal). | Exp, Task mgmt | **NEEDS PRODUCT DECISION** | L | 12 columns is a lot; many transitions are illegal so DnD UX is constrained. Drag lib = **new dep**. Decide value vs. the transition model. |
| Gantt / calendar timeline | erpnext / Frappe | Gantt of tasks by date/assignee. | Calendar/timeline view off `start_date`/`due_date`. | Exp | **NEEDS PRODUCT DECISION** (already Tier-3) | L | Likely a **new dep** (gantt/calendar lib); watch bundle size. Roadmap Tier 3. |
| @mentions in comments | erpnext / Frappe | `@user` mention → notification. | Mention parser in comment box → `create_notification` to the mentioned user (must be RLS-safe via the existing SECURITY DEFINER notify path). | Exp | **NEEDS PRODUCT DECISION** | M | Needs a user-picker readable under RLS; reuse `notify_role`/`create_notification` pattern. |

### C. Performance ideas (RSC + server actions + Supabase)

| Name | Source | What it is / how they do it | Native mapping | Goal | Fit | Effort | Risks / deps |
|------|--------|------------------------------|----------------|------|-----|--------|--------------|
| Server-side pagination + virtualization | erpnext | Desk list pages/virtual-scrolls large tables. | `.range()` pagination in the tasks data layer; cursor or page params; optional row virtualization for long lists. | Perf | **FITS** | M | Keep RLS; index `created_at`/`status` for stable ordering. |
| Indexing for hot filters | erpnext | DB indexes behind list filters. | Add btree indexes on `tasks(status, due_date, assignee_id)`; GIN for full-text. | Perf | **FITS** | S | Migration only; pure win. |
| Request-scoped caching | (RSC best practice; agentmemory caches recall) | agentmemory caches/dedups retrieval; ERPNext caches docs. | Wrap `getCurrentUser/Profile/Permissions` in React `cache()` (dedup per render). | Perf | **FITS** (= T1.5) | S | None — pure win. |
| Optimistic UI on mutations | (general) | — | `useOptimistic`/`useTransition` on status transitions, comments, mark-read. | Perf, Exp | **FITS** | M | Reconcile on server error; keep guard authoritative. |
| Background jobs / scheduled compute | erpnext | Scheduler runs digests, SLA, rollups. | Reuse the existing Vercel cron route pattern (already used for recurring tasks) for digests / auto-evaluations. | Perf | **FITS** (infra exists) | S–M | Needs `CRON_SECRET` (already a pending ops item). |
| Incremental dedup / idempotency | agentmemory | SHA-256 dedup window on observations; ERPNext `sent` flag on digests. | Idempotency keys / `sent`-style flags on cron-generated rows (recurring, digests) to avoid duplicates on retries. | Perf | **FITS** | S | Small column/guard; reduces double-fire risk. |
| Materialized rollups for dashboards | erpnext | Number-cards / dashboard charts precompute counts. | Postgres views (we already have `daily_employee_workload`) or materialized views for dashboard KPIs; refresh on cron. | Perf | **FITS** | M | Materialized views need a refresh strategy; keep RLS via security-barrier views. |

### D. From `agentmemory` specifically

> Honest framing: agentmemory is **dev-time workflow tooling**, not an app feature. Its value to
> TSS Planner splits into (D-1) **workflow/tooling for the team that builds TSS Planner** and
> (D-2) **conceptual inspiration** for the roadmap's Tier-4 "AI-assisted task planning" vision. We
> do **not** recommend embedding an agent-memory engine inside the product.

| Name | Source | What it is | Native mapping / use | Goal | Fit | Effort | Risks / deps |
|------|--------|-----------|----------------------|------|-----|--------|--------------|
| **(D-1) agentmemory as a dev workflow tool** | agentmemory | Persistent cross-session memory for the coding agent working on this repo (hooks + MCP). | Use it **outside** the product — on the dev's machine / CI — so the agent remembers TSS Planner conventions across sessions. **No change to BCPlanner.** | Dev velocity (not a product goal) | **N/A to product** (tooling) | S (opt-in, dev-side) | Local service + embeddings; nothing ships in the app. Purely the team's choice. |
| (D-2) AI-assisted task planning | agentmemory (analogy) | Suggest priorities, flag overdue patterns, draft summaries from history. | A future server action calling an LLM over the user's own task history; **summaries/suggestions only**, never auto-transitions. | Exp, Task mgmt | **NEEDS PRODUCT DECISION** (= roadmap **Tier-4 vision**) | L–XL | New external AI dep + data-governance/privacy review; explicit product decision. Not near-term. |
| (D-3) "Auto-forget"/decay for stale data | agentmemory | Memories decay (Ebbinghaus) and auto-evict. | Conceptual: retention/archival policy for old `notifications`/`audit_logs` to keep tables lean. | Perf | **NEEDS PRODUCT DECISION** | S–M | Deleting audit data has compliance implications — decide retention before automating. |
| (D-4) Confidence/decay-style ranking of suggestions | agentmemory | Confidence scoring + recency weighting on recall. | If D-2 ever happens, rank suggestions by recency/confidence rather than raw counts. | Exp | **NEEDS PRODUCT DECISION** | (depends on D-2) | Tied to D-2; ignore until then. |
| (D-5) Hybrid search (BM25 + vector) | agentmemory | Keyword + semantic retrieval. | TSS Planner search should stay **keyword/`tsvector`** (Group A). Semantic/vector search (pgvector) is a heavier, optional future step. | Perf | **NEEDS PRODUCT DECISION** | L | pgvector + embeddings = new infra + dep; overkill for a single-department task tool today. Note it, don't pursue. |

---

## Step 2 — Prioritization

### Interesting, but needs a product decision / expands scope

These have real value but introduce a new product concept, new schema beyond a derived field, a
new dependency, or touch the locked formula. Decide *before* building.

- **Task dependencies / blocking relationships** (erpnext) — new table + RLS + cycle prevention +
  optional auto-reschedule. Already roadmap **Tier 3**.
- **Gantt / calendar timeline** (erpnext) — likely a new dependency; roadmap **Tier 3**.
- **Kanban board** (erpnext) — drag lib (new dep) and the 12-status transition model makes many
  drops illegal; UX needs thought.
- **Parent/sub-tasks (task groups)** (erpnext) — introduces hierarchy; RLS and UX implications.
- **Task weight / weighted rollups** (erpnext) — risks confusing the **locked 40/30/30** score.
- **Milestones flag** (erpnext) — small, but a new product concept + schema.
- **Daily status digest** (erpnext `Project Update`) — new comms cadence (reuses email/cron infra).
- **SLA / escalation** (erpnext/Frappe) — new rules data + escalation-path decisions (Tier-3 SLA).
- **@mentions** (Frappe) — needs an RLS-safe user picker + mention→notify wiring.
- **AI-assisted task planning** (agentmemory analogy) — roadmap **Tier-4 vision**; external AI dep
  + data-governance review.
- **Semantic/vector search (pgvector)** (agentmemory) — new infra/dep; overkill for now.
- **Automated retention/auto-forget of audit/notifications** (agentmemory analogy) — compliance call.

### 🚫 DO-NOT list — conflicts with locked decisions (don't pursue without re-litigating)

- ❌ **Adding/changing task statuses.** ERPNext uses a different status set (incl. a real `Overdue`
  status) and its project/timesheet billing states. The **12 statuses are locked** — surface
  "overdue" as a *derived* badge, never a 13th status. Don't import ERPNext's status model.
- ❌ **Multi-department / multi-company.** ERPNext is multi-company with a `company`/`department`
  field on every doc. TSS Planner is **single department (Business Consulting)** — multi-department
  is explicitly **Tier-4 future vision**, not a feature to build now.
- ❌ **New / expanded roles.** ERPNext has rich role/permission tiers (project managers, etc.). The
  **4 roles are locked**; a department-head tier or external/guest collaborator is **Tier-4**.
  Don't add roles to fit an imported feature.
- ❌ **Changing the 40/30/30 performance formula.** ERPNext's costing/billing/weight metrics are
  tempting but the formula is **locked**. Weight/billing concepts must **not** alter it.
- ❌ **Timesheets / billing / costing / invoicing** (erpnext) — out of product scope; pulls in an
  ERP money model TSS Planner doesn't have and doesn't want.
- ❌ **Adopting either repo's stack or copying code.** No Frappe/Python, no `iii`/agent-memory
  engine, no ERPNext source in BCPlanner. Concepts only — reimplement natively.
- ❌ **Embedding an agent-memory service inside the product.** agentmemory is dev-time tooling; it
  is not a TSS Planner runtime dependency.
- ❌ **Adding `@tremor/react` or any Tailwind-v3/React-18 charting** to mimic ERPNext dashboards —
  explicitly excluded by **D10**. Stay on **recharts**.

---

## Licensing note

- **ERPNext is licensed GPLv3.** Copying GPLv3 source into BCPlanner (an otherwise non-GPL
  codebase) would impose GPL obligations on the combined work. **No ERPNext source has been or
  should be copied.** Only **non-copyrightable concepts, data-model ideas, and UX patterns** were
  extracted and re-described in our own words for native reimplementation. Facts, ideas, and
  general patterns are not protected by copyright; specific code, text, and assets are. Keep all
  reimplementation **clean-room** (work from this conceptual description, not from ERPNext files).
- **agentmemory** — check its `LICENSE` before any *tooling* adoption (D-1). It is **not** a code
  source for the product; only its architecture was studied conceptually. Nothing from it is
  copied into BCPlanner.
- **TSS Planner / BCPlanner** retains its own license unaffected by this analysis — the only
  artifact produced is this prose document.

---

*End of analysis. Diff = this one new file. Nothing implemented, installed, built, or executed.*
