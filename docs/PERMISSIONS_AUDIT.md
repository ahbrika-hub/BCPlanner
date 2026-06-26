# Permissions Reconciliation Audit

**Status: AUDIT ONLY — nothing in this document has been applied.** No
permission, `role_permissions` seed, RLS policy, route guard, `can()`,
`requirePermission()`, or migration was changed. Every SQL block below is marked
**PROPOSED — NOT APPLIED** and is provided so the owner can decide; a real
timestamped migration would be authored in a later, separate task **after**
approval (a migration merged to `main` auto-deploys to production).

This audit was derived **statically from the repository** (seed SQL + page
guards + docs). No production or staging database was queried. Read-only
verification SELECTs for **staging** are in §6.

---

## 1. Decisions needed from owner

1. **`ceo` cannot open `/reports`.** The Reports page guard checks **only**
   `reports.read`; `ceo` is seeded `reports.read_all` (not `reports.read`), so the
   guard blocks it — even though the role model says ceo has **read-all reports**.
   `/workload` and `/performance` already accept `read || read_all`; `/reports`
   does not. → **Decide how to reconcile** (recommended: align the guard;
   see M1).
2. **`dashboard.executive` is an orphaned permission.** It is seeded to `ceo` and
   `admin` but is **never checked anywhere in code** — the dashboard chooses its
   variant from `profile.role`, not from the permission. → **Decide:** enforce
   it, remove it, or document it as reserved (see M2).
3. **Confirm the authoritative role-model doc.** The brief references
   `PROJECT_CONTEXT` "Section 5", which **does not exist in this repo**. The only
   in-repo role model is `docs/DATABASE.md` (§"Permission catalogue (by role)"),
   and the seed matches it **exactly** (admin 38 / section_head 35 / employee 15 /
   ceo 10). If an external "Section 5" says something different (e.g.
   section_head should **not** manage users/settings), that is a **doc-vs-doc**
   conflict to resolve (see M3).
4. **Confirm `section_head` Administration scope is intended.** Per
   `docs/DATABASE.md` and `docs/MODULE_ADMIN.md`, `section_head` holds
   `users.read/manage/invite`, `settings.read/manage`, and `audit.read` — i.e.
   `section_head ≈ admin` minus `roles.manage`, `tasks.delete`, and
   `dashboard.executive`. Seed and repo docs **agree**; confirm this is still the
   desired model (see M4).

---

## 2. Sources & method

| Source                 | What it provides         | File                                                         |
| ---------------------- | ------------------------ | ------------------------------------------------------------ |
| Permission catalogue   | the 38 permission keys   | `supabase/migrations/20260606171529_reference_data_seed.sql` |
| Role → permission seed | per-role grants          | same file (`insert into role_permissions …`)                 |
| Route guards           | key each route requires  | `src/app/(app)/**/page.tsx`                                  |
| Documented role model  | intended access per role | `docs/DATABASE.md`, `docs/MODULE_ADMIN.md`                   |

> **Note:** `PROJECT_CONTEXT.md` / "Section 5" is **not present** in the repo
> (searched repo-wide). This audit treats `docs/DATABASE.md` as the in-repo
> documented model. If an authoritative external Section 5 exists, re-run §3
> against it.

### 2.1 Seeded grants (verbatim from the seed)

- **employee (15):** `dashboard.view`, `tasks.create`, `tasks.read`,
  `tasks.update`, `tasks.submit_review`, `task_updates.create`,
  `task_updates.read`, `task_comments.create`, `task_comments.read`,
  `attachments.upload`, `attachments.download`, `workload.read`,
  `performance.read`, `reports.read`, `notifications.read`.
- **section_head (35):** all employee, plus `tasks.read_all`, `tasks.approve`,
  `tasks.reject`, `tasks.return`, `tasks.assign`, `tasks.close`, `tasks.cancel`,
  `tasks.reopen`, `task_comments.address`, `workload.read_all`,
  `performance.read_all`, `performance.evaluate`, `recurring.manage`,
  `reports.read_all`, `settings.read`, `settings.manage`, `users.read`,
  `users.manage`, `users.invite`, `audit.read`.
- **ceo (10):** `dashboard.view`, `dashboard.executive`, `tasks.read_all`,
  `reports.read_all`, `workload.read_all`, `performance.read_all`,
  `task_comments.create`, `task_comments.read`, `attachments.download`,
  `notifications.read`.
- **admin (38):** every permission in the catalogue (incl. `roles.manage`,
  `tasks.delete`).

> **⚠️ Reconciliation note (current state supersedes the original seed above).**
> The figures in §2.1 are the *original* base seed. Subsequent migrations changed
> the catalogue and grants; the authoritative current totals (see
> `docs/FEATURE_INVENTORY.md`) are **47 keys** with **admin 46 · section_head 43 ·
> employee 17 · ceo 14**. Key deltas since the base seed: catalogue gained
> `signups.approve`, `projects.read/manage`, `templates.read/manage`,
> `tasks.request_update`; `section_head` gained `projects.manage`; `ceo` gained
> `tasks.create` + `tasks.request_update` and **lost** `workload.read_all` +
> `performance.read_all`. The current PR's permission tidy (migration
> `20260626140000`) then removes three decorative grants
> (`dashboard.executive`, `task_comments.read`, `task_updates.read`), leaving
> **admin 43 · section_head 41 · employee 15 · ceo 12** (catalogue unchanged at
> 47). M2 below (the `dashboard.executive` orphan) is resolved by that tidy.

### 2.2 Route guards (re-verified against the page code)

| Route             | Guard requires                                   | Notes                                           |
| ----------------- | ------------------------------------------------ | ----------------------------------------------- |
| `/dashboard`      | _none_ (authenticated)                           | variant chosen by `profile.role`                |
| `/tasks`          | _none_ (authenticated)                           | `tasks.create` gates only the "New Task" button |
| `/tasks/[id]`     | _none_ (authenticated)                           | row visibility via RLS                          |
| `/approvals`      | `tasks.approve`                                  |                                                 |
| `/notifications`  | _none_ (authenticated)                           |                                                 |
| `/workload`       | `workload.read` **OR** `workload.read_all`       | any-of                                          |
| `/performance`    | `performance.read` **OR** `performance.read_all` | any-of                                          |
| `/recurring`      | `recurring.manage`                               |                                                 |
| `/reports`        | `reports.read` **only**                          | ⚠️ not `read_all` — see M1                      |
| `/admin/users`    | `users.read`                                     |                                                 |
| `/admin/settings` | `settings.read`                                  |                                                 |
| `/admin/audit`    | `audit.read`                                     |                                                 |

---

## 3. Per-role: Documented vs Seeded vs Guard-Required

Legend: ✅ reachable / intended · ⛔ blocked / not intended · ⚠️ mismatch.

### 3.1 employee

| Route               | (a) Documented | (b) Seeded → reachable? | (c) Guard requires   | Verdict |
| ------------------- | -------------- | ----------------------- | -------------------- | ------- |
| /dashboard          | ✅ standard    | ✅ (authed)             | none                 | OK      |
| /tasks, /tasks/[id] | ✅ own tasks   | ✅                      | none + RLS           | OK      |
| /approvals          | ⛔ no approve  | ⛔ (no `tasks.approve`) | `tasks.approve`      | OK      |
| /notifications      | ✅             | ✅                      | none                 | OK      |
| /workload           | ✅ own         | ✅ (`workload.read`)    | read \| read_all     | OK      |
| /performance        | ✅ own         | ✅ (`performance.read`) | read \| read_all     | OK      |
| /recurring          | ⛔             | ⛔                      | `recurring.manage`   | OK      |
| /reports            | ✅ own         | ✅ (`reports.read`)     | `reports.read`       | OK      |
| /admin/\*           | ⛔             | ⛔                      | users/settings/audit | OK      |

**employee: no mismatches.**

### 3.2 section_head

All 12 routes reachable from the seed, and `docs/DATABASE.md` documents
section_head as holding the management + Administration permissions
(`tasks.approve`, `recurring.manage`, `users.*`, `settings.*`, `audit.read`).
**Documented = Seeded = Guard-reachable.** **No mismatches** (see M4 to confirm
intent).

### 3.3 admin

Holds all 38 permissions; reaches all routes. **Documented = Seeded.** No
mismatches.

### 3.4 ceo

| Route               | (a) Documented        | (b) Seeded → reachable?                             | (c) Guard requires | Verdict         |
| ------------------- | --------------------- | --------------------------------------------------- | ------------------ | --------------- |
| /dashboard          | ✅ executive+standard | ✅ (authed; `dashboard.executive`)                  | none               | OK (but see M2) |
| /tasks, /tasks/[id] | ✅ read-all           | ✅ (authed; `tasks.read_all` via RLS)               | none + RLS         | OK¹             |
| /approvals          | ⛔ no authoring       | ⛔ (no `tasks.approve`)                             | `tasks.approve`    | OK              |
| /notifications      | ✅                    | ✅                                                  | none               | OK              |
| /workload           | ✅ read-all           | ✅ (`workload.read_all`)                            | read \| read_all   | OK              |
| /performance        | ✅ read-all           | ✅ (`performance.read_all`)                         | read \| read_all   | OK              |
| /recurring          | ⛔                    | ⛔                                                  | `recurring.manage` | OK              |
| **/reports**        | **✅ read-all**       | **⛔ (has `reports.read_all`, not `reports.read`)** | **`reports.read`** | **⚠️ M1**       |
| /admin/users        | ⛔                    | ⛔                                                  | `users.read`       | OK              |
| /admin/settings     | ⛔                    | ⛔                                                  | `settings.read`    | OK              |
| /admin/audit        | ⛔ "no access"        | ⛔ (no `audit.read`)                                | `audit.read`       | OK ✅ confirmed |

¹ The Phase 2 sidebar keys the **Tasks** nav item on `tasks.read`, which ceo
lacks — so ceo doesn't see Tasks in the sidebar even though `/tasks` has no hard
guard and ceo can reach it directly (RLS shows all via `tasks.read_all`).
Cosmetic nav nuance, not a seed/guard authorization issue (see M5).

**ceo: one real mismatch (M1, reports) + observations M2, M5.**

---

## 4. Mismatches — classification & proposed resolution

### M1 — ceo blocked from `/reports` (Reports guard ignores `read_all`)

- **Observation:** `/reports` guard = `can("reports.read")` only. `ceo` is seeded
  `reports.read_all`. `/workload` and `/performance` accept `read || read_all`;
  `/reports` is the odd one out.
- **Classification:** **GUARD INCONSISTENCY** (primary) — equivalently a **SEED
  UNDER-GRANT relative to the guard**. The documented intent (ceo reads all
  reports) and the seed (`reports.read_all`) agree; the **guard** is the outlier.
- **Recommended resolution (real fix): align the guard** to
  `can("reports.read") || can("reports.read_all")`, matching workload/performance.
  This is a **code change to a route guard and is therefore OUT OF SCOPE for this
  audit** — flag for a separate "guard alignment" task. It needs **no** seed or
  doc change and benefits any `*_read_all` principal.
- **Option A — correct the seed (interim, if the guard cannot change):** grant
  `ceo` the base `reports.read`.
  ```sql
  -- PROPOSED — NOT APPLIED
  insert into public.role_permissions (role, permission_id)
  select 'ceo', id from public.permissions where key = 'reports.read'
  on conflict do nothing;
  ```
  _Caveat:_ `reports.read` semantically means "own reports"; ceo has none, so this
  is a workaround for the guard, not a clean model change.
- **Option B — update the doc:** state that ceo sees reporting via the executive
  dashboard only, not the `/reports` page. _Not recommended_ — contradicts the
  documented "read-all reports".
- **Recommendation:** **guard alignment** (separate task). If code is frozen, use
  **Option A**.

### M2 — `dashboard.executive` is an orphaned permission

- **Observation:** seeded to ceo + admin, but **no code references it**
  (`grep` finds it only in the seed). The dashboard variant is chosen by
  `profile.role === "ceo" | "section_head" | "admin"`. `dashboard.view` is used
  **only** by the sidebar nav item, never as a page guard.
- **Classification:** **DOC OUT OF DATE / DEAD PERMISSION** — harmless (no
  security impact; role and permission align for ceo) but misleading.
- **Option A — correct the seed/catalogue (only if truly unwanted):** remove the
  orphan key and its grants.
  ```sql
  -- PROPOSED — NOT APPLIED  (run only if the key is to be retired)
  delete from public.role_permissions rp
   using public.permissions p
   where p.id = rp.permission_id and p.key = 'dashboard.executive';
  delete from public.permissions where key = 'dashboard.executive';
  ```
- **Option B — update the doc:** note in `docs/DATABASE.md` that the dashboard
  variant is **role-driven** and `dashboard.executive` is **reserved /
  informational** (kept for a future permission-driven switch).
- **Recommendation:** **Option B** — keep the key (low risk, plausibly future
  use) and document that it is not currently enforced. Retire it (Option A) only
  if the team wants a strictly permission-driven model.

### M3 — Authoritative role-model doc is missing

- **Observation:** "PROJECT_CONTEXT Section 5" is not in the repo. The in-repo
  model (`docs/DATABASE.md`) matches the seed exactly.
- **Classification:** **NEEDS HUMAN CONFIRM** (process/doc gap).
- **Option B — doc:** designate `docs/DATABASE.md` §"Permission catalogue (by
  role)" as the source of truth (it already matches the seed), or import the
  external Section 5 into the repo and re-run §3 against it. Confirm live grants
  with §6.
- **Recommendation:** adopt `docs/DATABASE.md` as authoritative unless an external
  Section 5 is produced.

### M4 — section_head Administration access (confirm intent)

- **Observation:** `section_head` is seeded `users.read/manage/invite`,
  `settings.read/manage`, `audit.read`. `docs/DATABASE.md` and
  `docs/MODULE_ADMIN.md` both document this (MODULE_ADMIN even states audit is
  "section_head/admin"). Seed and repo docs **agree**.
- **Classification:** **INTENTIONAL — NEEDS HUMAN CONFIRM** only against any
  external "admin manages users/settings" statement.
- **Option A — correct the seed (only if the intent is admin-only):** revoke the
  Administration grants from section_head.
  ```sql
  -- PROPOSED — NOT APPLIED  (ONLY if section_head must lose Administration)
  delete from public.role_permissions rp
   using public.permissions p
   where rp.role = 'section_head' and p.id = rp.permission_id
     and p.key in ('users.read','users.manage','users.invite',
                   'settings.read','settings.manage');
  -- NOTE: leave 'audit.read' — it is explicitly documented for section_head.
  ```
- **Option B — doc:** confirm in the role model that section_head intentionally
  shares Administration (minus `roles.manage`).
- **Recommendation:** **Option B (no change)** — seed and both repo docs agree;
  only revoke if an authoritative source says admin-only.

### M5 — (cosmetic) ceo's Tasks sidebar item

- **Observation:** `/tasks` has no hard guard, but the sidebar keys **Tasks** on
  `tasks.read`, which ceo lacks (ceo has `tasks.read_all`). So ceo can reach
  `/tasks` directly but doesn't see it in the sidebar.
- **Classification:** **INTENTIONAL / cosmetic** (navigation display, not
  authorization). No seed/guard issue.
- **Resolution (nav, not this audit):** if ceo should see Tasks, key that nav
  item on `tasks.read || tasks.read_all` (mirrors the existing
  workload/performance pattern). A navigation decision for the owner — listed for
  completeness only.

---

## 5. Summary

- The **seed is internally consistent with the in-repo documented model**
  (`docs/DATABASE.md`): admin 38 / section_head 35 / employee 15 / ceo 10 — exact.
- **One real authorization mismatch:** **M1** — the `/reports` guard ignores
  `reports.read_all`, blocking ceo. Best fixed at the **guard** (separate task).
- **One dead permission:** **M2** — `dashboard.executive` is unenforced.
- **Two confirmations needed:** **M3** (authoritative doc) and **M4**
  (section_head Administration scope) — both currently consistent in-repo.
- No SEED OVER-GRANTs and no other SEED UNDER-GRANTs were found.

---

## 6. Staging-only read-only verification (owner to run on STAGING)

Run these on **staging** (never production) to confirm the live database matches
the repo seed this audit relied on. All are read-only `SELECT`s.

```sql
-- 6.1 Per-role grant counts — expect admin=43, section_head=41, employee=15, ceo=12
--     (post permission-tidy migration 20260626140000; pre-tidy: 46/43/17/14)
select rp.role, count(*) as granted
from public.role_permissions rp
group by rp.role
order by rp.role;

-- 6.2 Full role → key matrix (compare against §2.1)
select rp.role, p.category, p.key
from public.role_permissions rp
join public.permissions p on p.id = rp.permission_id
order by rp.role, p.category, p.key;

-- 6.3 M1: does ceo hold the Reports guard's key? Expect FALSE.
select exists (
  select 1
  from public.role_permissions rp
  join public.permissions p on p.id = rp.permission_id
  where rp.role = 'ceo' and p.key = 'reports.read'
) as ceo_has_reports_read;

-- 6.4 M2: who holds dashboard.executive? Expect NONE after the tidy migration
--     20260626140000 (pre-tidy this was {ceo, admin}).
select rp.role
from public.role_permissions rp
join public.permissions p on p.id = rp.permission_id
where p.key = 'dashboard.executive'
order by rp.role;

-- 6.5 Catalogue size — expect 47
select count(*) as permission_count from public.permissions;
```
