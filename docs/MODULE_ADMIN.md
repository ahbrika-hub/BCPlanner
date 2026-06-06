# Module: Management & Config

The admin modules: recurring-task generation, user management (with a privilege
guard and invite flow), application settings, and the audit-log viewer.

## Migration (`management_support`)

- **`generate_due_recurring_tasks()`** (SECURITY DEFINER) — for each active
  `recurring_tasks` row with `next_generation_date <= current_date`, inserts a
  `tasks` row from the template (status `assigned` if it has an assignee, else
  `pending_approval`, `start_date = current_date`) and advances
  `next_generation_date` by the template frequency (weekly/monthly/quarterly).
  Returns the count.
- **`guard_profile_privileges()`** (BEFORE UPDATE on `profiles`, SECURITY
  DEFINER) — blocks an authenticated user from changing `role`, `department_id`,
  or `is_active` unless they hold `users.manage`. Non-privileged fields
  (`full_name`, `job_title`, `avatar_url`) remain self-editable. Skips when
  `auth.uid()` is null (server / service-role / SQL-console context), so the
  documented first-admin promotion still works.

## Data layer (`src/lib/data/`)

`recurring.ts` (list/get/create/update/delete + `generateDueTasks` rpc),
`users.ts` (list/get/update + `countActiveAdmins`), `settings.ts` (list/update),
`audit.ts` (paginated list + actor name), `departments.ts` (list).

## Server actions (`src/lib/actions/`)

All validate (Zod) → re-check permission → call data layer → `revalidatePath`.

- **recurring**: `createRecurringAction`, `updateRecurringAction`,
  `deleteRecurringAction`, `generateNowAction` — gated `recurring.manage`.
- **users**: `updateUserAction` (gated `users.manage`; blocks demoting/
  deactivating the **last active admin** via `countActiveAdmins`),
  `inviteUserAction` (see below).
- **settings**: `updateSettingsAction` — gated `settings.manage`.
- Audit is read-only (no actions).

## Recurring tasks (`/recurring`)

Gated `recurring.manage`. Table of templates with active toggle, edit, delete,
and a **Generate Due Tasks Now** button. Automatic daily generation (Supabase
`pg_cron` or a Vercel Cron route calling the function) is planned for Phase 7 —
manual trigger for now.

## User management (`/admin/users`)

Gated `users.read` (view) / `users.manage` (edit). Table with avatar, name,
email, role, department, status; client filters (search/role/status). Edit dialog
(role / department / active / name / job title) → `updateUserAction`.

Guardrails:

- **Last-admin protection** — server blocks demoting or deactivating the final
  active admin.
- **Self-change confirm** — editing your own role/active status prompts a
  confirm.
- **Privilege guard** — the DB trigger additionally blocks any non-`users.manage`
  user from changing privileged columns, even via direct API.

### Invite flow (service-role pending)

The Supabase Admin API needs a server-side **service-role key**, whose rotation
is pending (Phase 7). `inviteUserAction` is feature-gated:

- **No `SUPABASE_SERVICE_ROLE_KEY`** → returns guidance to invite via the
  Supabase Dashboard (Authentication → Invite User). `handle_new_user` creates
  the profile as `employee`; an admin then sets role/department here.
- **Key present** → dynamically builds an admin client and calls
  `auth.admin.inviteUserByEmail`. **No key is ever hardcoded.**

## Settings (`/admin/settings`)

Gated `settings.read` (view) / `settings.manage` (edit). Renders `app_settings`
as a labelled form (`due_soon_threshold`, `no_update_threshold`, plus any other
keys) → `updateSettingsAction`. Email feature flags are deferred to Phase 7.

## Audit log (`/admin/audit`)

Gated `audit.read` (section_head/admin) — **ceo has no access**. Read-only,
paginated table: time, actor, action, entity (links to the task when
`entity_type = 'task'`), with a detail dialog showing the before/after JSON.
Filters: entity type, action, date range. The Phase 4 status-change trigger
populates this.

## Validation

`typecheck` / `lint` / `build` pass. Migration applied on PostgreSQL 16:
generation creates a task and advances the date; the privilege guard rejects
self-escalation and allows manager edits. Interactive multi-role verification
(recurring generation in UI, user edits, settings save, audit filters, ceo
no-access) should be confirmed on the deployed app with seeded users.
