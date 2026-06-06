# Module: Core Task System

The task lifecycle module: data access, server actions, the transition UI, and
notification rules. Builds on the Phase 2 schema/RLS/guard and the Phase 3 shell.

## Migrations (Part A)

- `task_system_support` — `create_notification(...)` (SECURITY DEFINER; lets
  server actions notify other users despite the no-client-insert notifications
  RLS), the `task-attachments` storage bucket + `storage.objects` policies
  (upload/download/delete gated by `authorize()`), and a status-change audit
  trigger (`log_task_status_change`).
- `notify_role` — SECURITY DEFINER helper to notify every active user of a role
  (e.g. an employee notifying all section heads on submission without being able
  to read other profiles under RLS).

## Data access layer (`src/lib/data/`, RLS-enforced)

`tasks` (list/get with joined names, create, update, transition), `task-updates`
(list/add — the DB trigger advances `assigned/approved/pending_update` →
`in_progress`), `comments` (list/add/markAddressed), `attachments`
(list/upload/signed-url/delete via Supabase Storage), `workload`
(`daily_employee_workload` view), `notifications` (list/unread count/mark
read/all), `business-lines`, `profiles` (assignable users). Shared display types
in `data/types.ts`.

## Server actions (`src/lib/actions/`)

Each action: Zod-validates input → re-checks permission with `can()` → calls the
data layer → creates notifications via `rpc('create_notification'/'notify_role')`
→ `revalidatePath()` → returns `{ ok, error? }`.

- `tasks.ts` — `createTaskAction` (employee → `pending_approval` & notify section
  heads; section_head/admin → `assigned`), `updateTaskAction`,
  `transitionTaskAction`.
- `collaboration.ts` — `addUpdateAction`, `addCommentAction` (CEO office comments
  notify section heads), `markAddressedAction`, `uploadAttachmentAction`
  (≤10MB, blocks executables), `getAttachmentUrlAction` (signed URL),
  `deleteAttachmentAction`.
- `notifications.ts` — `markNotificationReadAction`, `markAllNotificationsReadAction`.

## Transition UI (`src/lib/tasks/transitions.ts`)

`ACTIONS` mirrors the Migration 5 guard (single source of truth).
`getAvailableActions(status, role, permissions)` returns the actions offered from
a status, filtered by permission. The DB guard + RLS remain the authority; the UI
only offers what the guard allows. `TaskActionBar` renders the buttons and the
per-action input (reason / assignee / closure summary + rating / progress).

| Action              | From → To                                  | Permission          | Input            |
| ------------------- | ------------------------------------------ | ------------------- | ---------------- |
| submit_for_approval | draft → pending_approval                   | tasks.update        | —                |
| approve             | pending_approval → approved                | tasks.approve       | —                |
| reject              | pending_approval → rejected                | tasks.reject        | reason           |
| assign              | approved/reopened → assigned               | tasks.assign        | assignee         |
| log_progress        | active → (auto in_progress)                | task_updates.create | progress         |
| submit_review       | active → pending_review                    | tasks.submit_review | —                |
| close               | pending_review → completed                 | tasks.close         | summary + rating |
| return              | pending_review → returned_for_modification | tasks.return        | reason           |
| cancel              | most → cancelled                           | tasks.cancel        | —                |
| reopen              | completed/cancelled/rejected → reopened    | tasks.reopen        | —                |

## Notification rules

- create (employee) → `notify_role(section_head)`
- approve / reject / return → notify creator
- assign → notify assignee
- submit_review → `notify_role(section_head)`
- close / cancel / reopen → notify creator + assignee
- CEO office comment → `notify_role(section_head)`

Reject/return also record the reason as a `task_specific` comment.

## Pages

`/tasks` (filterable table + New Task dialog), `/tasks/[id]` (overview + action
bar + Updates/Comments/Attachments tabs), `/approvals` (Pending Approval +
Pending Review queues, gated by `tasks.approve`), `/workload`
(`daily_employee_workload`, gated by `workload.read`/`read_all`),
`/notifications` (list + mark read/all; top-bar bell shows the unread count).

## Validation notes

Validated on a local PostgreSQL 16 cluster (Docker unavailable): full lifecycle
runs end-to-end under RLS with role-scoped JWT claims — employee create →
section_head approve/assign → assignee progress (auto → in_progress) →
submit_review → section_head close (completed/100%); notifications and audit rows
written; illegal transitions and close-without-closure rejected by the guard.
`typecheck`/`lint`/`build` pass.
