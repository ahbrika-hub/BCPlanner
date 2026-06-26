# Findability + Hygiene — Completion Report

A bundle of four coherent, additive changes: (A) @mentions in task comments,
(B) a ⌘K command palette, (C) documentation-drift reconciliation, (D) a
permission tidy. The task approval/transition lifecycle was **not** touched.

---

## 1. Branch

**`feat/findability-hygiene`** — created off `main` as the **first action**, before
any file was modified (`git checkout main && git pull && git checkout -b
feat/findability-hygiene`). `main` already contained the previously-merged
saved-views work. Feature branch → PR to `main`; `main` is never pushed to.

---

## 2. Summary + safety-valve status

| Part | What shipped |
|------|--------------|
| **A — @mentions** | Type `@` in a task comment to mention a colleague who can see the task. Only mentioned + visible users get a single `mention` notification (no broadcast). Mentions render as chips. |
| **B — Command palette** | App-wide ⌘K / Ctrl-K palette: search tasks (existing full-text search, soft-nav so the task `@modal` intercept fires) and "Create task" (existing dialog, gated on `tasks.create`). |
| **C — Doc drift** | Corrected permission counts and the `requirePermission()` claim across `DATABASE.md`, `README.md`, `PERMISSIONS_AUDIT.md`, `FEATURE_INVENTORY.md`. |
| **D — Permission tidy** | Removed 3 decorative `role_permissions` grants via a new migration. |

**(D) safety valve: NOT triggered.** All three keys were proven decorative — zero
`can()`/`authorize()`/nav references in code (fixed-string grep) and zero RLS
policies consulting them (verified on the PG16 replica: `policies_referencing = 0`).
Removal broke nothing, so (D) stays in this PR.

---

## 3. Files changed / added

### Migrations
- `supabase/migrations/20260626130000_comment_mentions.sql` — **new**: adds enum
  value `mention` to `notification_type`; adds `task_comments.mentioned_user_ids
  uuid[]`; adds `task_mentionable_users(uuid)` SECURITY DEFINER fn.
- `supabase/migrations/20260626140000_permission_tidy_decorative_grants.sql` —
  **new**: idempotent `DELETE` of the 3 decorative grants from `role_permissions`.

### (A) @mentions
- `src/types/database.types.ts` — `mention` enum value (union + const), `mentioned_user_ids` on `task_comments` Row/Insert/Update, `task_mentionable_users` RPC type.
- `src/lib/validations/comments.ts` — **new** `addCommentSchema` (text + `mentionedUserIds: uuid[]`).
- `src/lib/validations/index.ts` — export the new schema.
- `src/lib/data/comments.ts` — `listMentionableUsers()` (RPC wrapper) + `getDisplayNames()` for chip names.
- `src/lib/actions/collaboration.ts` — `addCommentAction` now validates input, re-derives the visible audience server-side, persists only valid mentions (deduped, self-excluded), and fires one `mention` notification each.
- `src/components/tasks/comments-section.tsx` — `@` picker (keyboard-navigable) + mention-chip rendering.
- `src/components/tasks/task-detail-content.tsx` — fetches the mentionable list + resolves mention names, passes both to the composer.

### (B) Command palette
- `src/components/ui/command.tsx` — **new** shadcn Command (cmdk) wrapper, with `shouldFilter` passthrough.
- `src/lib/actions/palette.ts` — **new** `searchTasksAction` (reuses `listTasks` FTS) + `getTaskCreateDataAction` (reference data for the existing dialog, gated on `tasks.create`).
- `src/components/layout/command-palette.tsx` — **new** ⌘K palette; search + create modes.
- `src/components/tasks/new-task-dialog.tsx` — made open-controllable (`open`/`onOpenChange`/`showTrigger`) so the palette reuses it without duplicating the form.
- `src/components/layout/app-shell.tsx` — mounts `<CommandPalette/>` app-wide.
- `package.json` — adds `cmdk` (only new dependency).

### (C) Docs
- `docs/DATABASE.md`, `docs/README.md`… see the table in §6.
- `docs/FEATURE_INVENTORY.md`, `docs/PERMISSIONS_AUDIT.md` — reconciled to the catalogue and annotated with the post-tidy totals.

### (D) — covered by Migration 2 above.

---

## 4. @mentions data-model decision + visibility rule

**Decision: a `uuid[]` column (`task_comments.mentioned_user_ids`), not a join
table.** Justification: mentions are a small, bounded, per-comment set that is
always read together with the comment and never queried in the "which comments
mention user X?" direction (the per-user fan-out + queryability already lives in
`notifications`). A column keeps the data in the same row with no extra join and
matches the project's lightweight additive style (cf. `saved_views.config`). A
join table would add a table, RLS policies, and a join for zero functional gain.

**Exact visibility rule reused** (identical to the `tasks_select` /
`task_comments_select` RLS): a user can see a task **iff**
`created_by = auth.uid()` **OR** `assignee_id = auth.uid()` **OR**
`authorize('tasks.read_all')`. This is implemented once in
`task_mentionable_users(p_task_id)` (SECURITY DEFINER, `search_path=''`), which
also verifies the **caller** can see the task before returning any audience — so
it can never reveal an audience for a task the caller can't see. The composer
uses it for the picker (convenience) and `addCommentAction` re-runs it as the
**gate** (`requested ∩ audience − self`, deduped) before persisting/notifying.

---

## 5. Command-palette wiring (what it reuses)

- **Search** → `searchTasksAction` → existing `listTasks({ search })` →
  `search_vector` (the `'simple'` FTS column) + `task_no` trigram. RLS-scoped to
  the caller's visible tasks. Selecting a result calls `router.push('/tasks/:id')`
  (soft nav), so the existing `@modal/(.)tasks/[id]` intercept still opens the
  task in a modal.
- **Create** → `getTaskCreateDataAction` returns reference data, then the palette
  renders the **existing** `NewTaskDialog` (via `NewTaskDialogLazy`) in controlled
  mode (`showTrigger={false}`). The form and `createTaskAction` are unchanged —
  no duplication. The create entry is gated on `can('tasks.create')`.
- No new data model. Esc / overlay close the palette; ⌘K toggles it.

---

## 6. (C) Documentation edits (old → new)

| File | Location | Old | New |
|------|----------|-----|-----|
| DATABASE.md | catalogue total | "38 total permission keys" | **47** keys |
| DATABASE.md | employee count | "employee (15)" | **17** |
| DATABASE.md | section_head count | "section_head (35)" | **43** (notes `projects.manage`) |
| DATABASE.md | ceo | "ceo (10) … No task authoring" | **14**; gained `tasks.create` + `tasks.request_update`, lost `workload.read_all` + `performance.read_all` |
| DATABASE.md | admin count | "admin (38): all permissions" | **46** (all except `tasks.request_update`) |
| DATABASE.md | reconciliation note | "38 / 15 / 35 / 10 … verified vs seed" | authoritative 47 · 46/43/17/14, + a **post-tidy** note (43/41/15/12) |
| README.md | stack line | "enforced by … `can()`/`requirePermission()`" | inline `can()` + EmptyState; `requirePermission()` exists but **unused by pages** |
| PERMISSIONS_AUDIT.md | §2.1 | seed figures 15/35/10/38 only | added reconciliation note (current 46/43/17/14, post-tidy 43/41/15/12) |
| PERMISSIONS_AUDIT.md | §6 staging queries | "expect admin=38, section_head=35, employee=15, ceo=10"; "dashboard.executive → {ceo,admin}"; "catalogue 38" | post-tidy expectations (43/41/15/12; none; 47) |
| FEATURE_INVENTORY.md | totals + matrix + flags | 46/43/17/14, decorative grants "granted-but-unused" | post-tidy 43/41/15/12; the 3 cleared cells marked `—†`; flag updated to "REMOVED in this PR" |

> Note on the (C)/(D) interaction: `FEATURE_INVENTORY.md`'s pre-tidy figure was
> 47 · 46/43/17/14. Because (D) lands in the **same** PR, the docs carry both the
> reconciled pre-tidy totals **and** the post-tidy totals (43/41/15/12) so no doc
> is left contradicting the merged schema.

---

## 7. (D) BEFORE/AFTER role_permissions + per-key decision

**Per-key decision — all three REMOVED** (default), justified by zero references:

| Key | Held by (before) | Why decorative | Decision |
|-----|------------------|----------------|----------|
| `dashboard.executive` | admin, ceo | Executive dashboard is gated by `role === 'ceo'`, not this key | Remove |
| `task_comments.read` | admin, section_head, employee, ceo | `task_comments_select` RLS uses task-visibility (`tasks.read_all`), not this key | Remove |
| `task_updates.read` | admin, section_head, employee | `task_updates_select` RLS uses task-visibility, not this key | Remove |

Only the **grants** are removed; the permission **keys** stay in the catalogue
(size unchanged at 47), keeping the change reversible.

**Recomputed per-role totals:** `admin 46→43 · section_head 43→41 · employee
17→15 · ceo 14→12`. (Gate B output in §9.)

---

## 8. Gate A — actual output

`npm run lint`
```
> bc-planner@0.1.0 lint
> eslint

```
Exit 0.

`npm run typecheck`
```
> bc-planner@0.1.0 typecheck
> tsc --noEmit

```
Exit 0.

`npm run test`
```
 Test Files  38 passed (38)
      Tests  176 passed (176)
   Duration  6.23s
```
Exit 0.

`npm run build` (tail)
```
Route (app)   … (22/22 pages generated)
ƒ Proxy (Middleware)
○  (Static)   prerendered as static content
ƒ  (Dynamic)  server-rendered on demand
```
Exit 0.

**Dependencies:** only `cmdk` (`^1.1.1`) added — the shadcn Command primitive,
explicitly allowed. `tailwind-merge` stays `^3.6.0` (3.x). No other deps changed.

---

## 9. Gate B — PG16 replica proofs (actual output)

Fresh PostgreSQL **16.13** cluster; prod-only roles + `auth`/`storage` shims
created with `CREATE … IF NOT EXISTS`; all migrations applied (the tidy deferred
so BEFORE/AFTER can be captured).

### A — @mentions

Mentionable audience as the author (task created_by=Ann, assignee=Bob; Mara is a
section_head with `tasks.read_all`; Olu is an unrelated employee):
```
                  id                  | display_name
--------------------------------------+--------------
 0a000000-0000-4000-8000-000000000002 | Assignee Bob
 0a000000-0000-4000-8000-000000000001 | Author Ann
 0a000000-0000-4000-8000-000000000004 | Manager Mara
(3 rows)
```
Olu (no visibility) is absent. Simulating `addCommentAction` notify with
requested = {Bob, Bob(dup), Ann(self), Olu(no-visibility)} → rule
`distinct(requested ∩ audience − self)` produced **one** `create_notification`
call, and the resulting notifications are:
```
  full_name   | mention_notifications
--------------+-----------------------
 Assignee Bob |                     1
(1 row)
```
- **Exactly one** `mention` notification for the mentioned user (Bob); **zero**
  for the other participants (Ann/Mara) and the outsider (Olu) → no broadcast.
- **Dedup:** Bob requested twice → 1 notification.
- **Self-mention:** Ann (author) requested → 0 (excluded).
- **Visibility:** Olu requested → 0; and the audience check confirms it:
```
 olu_in_audience
-----------------
               0
```
A mention therefore cannot leak a task to a user scoped out of it.

### D — permission tidy (BEFORE → AFTER)

BEFORE (tidy deferred):
```
     role     | grants                          key         |               roles
--------------+--------       ---------------------+-----------------------------------
 admin        |     46         dashboard.executive | {admin,ceo}
 section_head |     43         task_comments.read  | {admin,section_head,employee,ceo}
 employee     |     17         task_updates.read   | {admin,section_head,employee}
 ceo          |     14        catalogue keys: 47
```
AFTER applying `20260626140000`:
```
     role     | grants            key         | grants        catalogue keys: 47
--------------+--------    ---------------------+--------       policies_referencing: 0
 admin        |     43      dashboard.executive |      0
 section_head |     41      task_comments.read  |      0
 employee     |     15      task_updates.read   |      0
 ceo          |     12
```
The 3 keys keep their catalogue entries but have **0 grants**; catalogue stays
**47**; **0** RLS policies consult any of the 3 keys (DB-level proof the keys are
unreferenced — combined with the zero code/nav references found by grep).

### Lifecycle (`validate_task_transition`) — unchanged

```
-- legal: draft -> pending_approval
UPDATE 1
 id (…002) | status = pending_approval

-- illegal: draft -> completed
NOTICE:  BLOCKED as expected: Illegal task status transition: draft -> completed
 id (…003) | status = draft   (unchanged)
```
A legal transition still passes and an illegal one still raises
`check_violation` — this PR did not touch the lifecycle function/trigger (the
`20260606141054_tasks_core.sql` migration is unchanged).

---

## 10. Assumptions, out-of-scope, manual ops

**Assumptions / decisions**
- `mention` added to the existing `notification_type` enum (no suitable value
  existed; `comment_added` is a different, role-broadcast concept). `ADD VALUE IF
  NOT EXISTS` is idempotent and is not *used* in its own migration, so it is safe
  inside the migration transaction on PG16.
- Mention notifications deep-link at the **task** level (`task_id`), reusing the
  existing notification → `/tasks/:id` navigation; the schema has no per-comment
  anchor and adding one was out of scope.
- Palette task search caps at 8 results (slim, RLS-scoped); stated in code.

**Out of scope (future):** mentions outside task comments; mentioning
roles/groups; email-on-mention (in-app only — email stays `EMAIL_ENABLED`-gated
and is not wired here); palette actions beyond search + create.

**Manual ops:** **none** beyond merging the PR and the normal `supabase db push`
(applies both new migrations). After deploy, `npm run types:gen` regenerates
`database.types.ts` (the hand-added `mention` value / `mentioned_user_ids` /
`task_mentionable_users` entries match what the CLI emits). **No storage-policy
change and no service-role path** were introduced in this PR.
