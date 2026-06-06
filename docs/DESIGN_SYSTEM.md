# Design System

TSS Planner's executive UI system: shadcn/ui (New York) on Tailwind v4 `@theme`,
TSS brand colors, a cool-neutral surface ramp, the harmonized task-status /
priority palettes, a density-oriented type scale, and a small set of canonical
UI primitives.

> **Phase 1 (Token Foundation + Shared UI Primitives).** This phase deepened the
> token system and standardized the primitives below. Contrast figures are
> computed with the WCAG relative-luminance formula. Tokens live in
> `src/app/globals.css`; primitives in `src/components/ui/` and
> `src/components/layout/`.

---

## 1. Token architecture

All tokens are defined in `src/app/globals.css`:

- **`@theme`** — primitive + scale tokens that back Tailwind utilities (colors,
  type scale, spacing, radius, shadow, font).
- **`@theme static`** — the status & priority color tokens. They are consumed
  only via inline `var(--color-status-*)` / `var(--color-priority-*)` (never as
  utility classes), so `static` is required to stop Tailwind from tree-shaking
  them out of `:root`.
- **`@theme inline`** — semantic aliases that map shadcn's runtime vars
  (`--background`, `--card`, …) into the Tailwind color namespace, plus the
  Phase 1 `bg` / `surface` / `fg` / `fg-muted` aliases.
- **`:root` / `.dark`** — the shadcn semantic variables, now mapped onto the
  cool-neutral ramp. (`.dark` is kept coherent but is currently dormant — no
  `ThemeProvider` mounts `.dark`.)

### 1.1 Brand (unchanged)

| Token                     | Value     | Note                                                |
| ------------------------- | --------- | --------------------------------------------------- |
| `--color-brand-primary`   | `#762651` | TSS Burgundy — primary/action (9.7:1 on white, AAA) |
| `--color-brand-secondary` | `#193560` | SAPTCO Navy — supporting (12.2:1 on white, AAA)     |

These also drive `--primary`, `--secondary`, `--ring`, `--chart-1`, `--chart-2`,
and the sidebar active accent. **Do not change the brand hexes.**

### 1.2 Cool-neutral ramp + semantic aliases

shadcn's default neutral is a _pure_ gray. We deliberately replaced it with a
**cool, slate-tinted** ramp: the brand (burgundy + navy) is cool, and a pure/warm
gray reads muddy beside it, whereas slate keeps surfaces calm and "executive."

| Step | Hex       | Step | Hex       |
| ---- | --------- | ---- | --------- |
| 50   | `#f8fafc` | 500  | `#64748b` |
| 100  | `#f1f5f9` | 600  | `#475569` |
| 200  | `#e2e8f0` | 700  | `#334155` |
| 300  | `#cbd5e1` | 800  | `#1e293b` |
| 400  | `#94a3b8` | 900  | `#0f172a` |
|      |           | 950  | `#020617` |

`--color-gray-*` is aliased onto this ramp for back-compat. The shadcn semantic
vars are mapped as follows (the change is a subtle cool shift, no structural
regression):

| shadcn var           | Maps to     | Used as                                       |
| -------------------- | ----------- | --------------------------------------------- |
| `--background`       | `#ffffff`   | page background (`bg-bg`)                     |
| `--foreground`       | neutral-900 | body text (`text-fg`)                         |
| `--card` / popover   | `#ffffff`   | card surface (`bg-surface`)                   |
| `--muted`            | neutral-100 | muted fills (`bg-muted`)                      |
| `--muted-foreground` | neutral-500 | secondary text — **4.76:1** (`text-fg-muted`) |
| `--border` / input   | neutral-200 | hairline borders (`border-border`)            |
| `--destructive`      | `#b91c1c`   | aligned to `--color-danger`                   |

**Semantic aliases (prefer these in new code):** `bg-bg`, `bg-surface`,
`text-fg`, `text-fg-muted`, `border-border`, `bg-muted`.

### 1.3 Type scale (density-oriented)

Body default is **`text-sm` (14px)**; 16px (`text-base`) is reserved for
emphasis. Each size pairs an explicit line-height (no per-element overrides).

| Token       | Size     | px  | Line-height    | Role            |
| ----------- | -------- | --- | -------------- | --------------- |
| `text-xs`   | 0.75rem  | 12  | 1rem (16)      | caption / label |
| `text-sm`   | 0.875rem | 14  | 1.25rem (20)   | **body**        |
| `text-base` | 1rem     | 16  | 1.5rem (24)    | emphasis body   |
| `text-lg`   | 1.125rem | 18  | 1.75rem (28)   | lead            |
| `text-xl`   | 1.25rem  | 20  | 1.75rem (28)   | h3              |
| `text-2xl`  | 1.5rem   | 24  | 1.95rem (~1.3) | h2 / page title |
| `text-3xl`  | 1.875rem | 30  | 2.25rem (1.2)  | h1              |

`h1`–`h3` defaults are applied in `@layer base`; element utilities override.

### 1.4 Spacing rhythm (4px base)

Built on Tailwind's 4px base (`--spacing: 0.25rem`). Named tokens
(`--space-page/card/stack/table-*`) document the intended cadence; use the
matching utilities:

| Use   | Cadence              | Utilities             |
| ----- | -------------------- | --------------------- |
| page  | 16px / 32px desktop  | `p-4 md:p-8`          |
| card  | 24px padding         | `p-6` (KpiCard `p-5`) |
| stack | 16px vertical rhythm | `space-y-4` / `gap-4` |
| table | 16px x / 8px y cell  | `px-4` / `py-2`       |

### 1.5 Radius, elevation, focus ring

- **Radius:** base `--radius: 0.625rem` (10px) with `--radius-sm` (6px),
  `--radius-md` (8px), `--radius-lg` (10px), plus larger steps.
- **Elevation (restrained):** `--shadow-xs/sm/md` are a hairline border + a
  whisper of cool shadow (slate-tinted). **Never** heavy drop shadows. `Card`
  uses `shadow-sm`.
- **Focus ring:** one ring identity — `--ring` is TSS Burgundy, applied at
  reduced intensity via `ring-ring/50` on every interactive primitive.

### 1.6 Typography routing (Frutiger swap)

ALL font usage routes through `--font-sans` (`html` + `body` + `font-sans`).
Inter is the interim face, self-hosted by `next/font` as `--font-inter`. To swap
in **Frutiger LT Arabic** when files arrive:

1. Add the font (e.g. `next/font/local`) exposing a CSS variable.
2. Point `--font-inter` (or replace it) at the new font in `src/app/layout.tsx`.
3. `--font-sans` already drives `font-sans` app-wide — no component changes.

**Do not** hardcode `font-family` anywhere else.

---

## 2. Status color system (12 statuses)

Same 12 statuses / meanings as always — **only the hues were tuned** so the set
reads as one coherent system, grouped by lifecycle family. Each is verified
≥4.5:1 as text on white (and on the slate-50 surface). Rendered by `StatusBadge`
via `var(--color-status-<status>)`.

| Family              | Status                    | Hex       | On white |
| ------------------- | ------------------------- | --------- | -------- |
| **neutral**         | draft                     | `#475569` | 7.58:1   |
| (slate)             | cancelled                 | `#64748b` | 4.76:1   |
| **active**          | approved                  | `#2563eb` | 5.17:1   |
| (blue / navy)       | assigned                  | `#1d4ed8` | 6.70:1   |
|                     | in_progress               | `#1e40af` | 8.72:1   |
|                     | reopened                  | `#0e7490` | 5.36:1   |
| **needs-attention** | pending_approval          | `#b45309` | 5.02:1   |
| (amber / orange)    | pending_update            | `#c2410c` | 5.18:1   |
|                     | pending_review            | `#a16207` | 4.92:1   |
|                     | returned_for_modification | `#9a3412` | 7.31:1   |
| **terminal +**      | completed                 | `#15803d` | 5.02:1   |
| **terminal −**      | rejected                  | `#b91c1c` | 6.47:1   |

At-a-glance: neutral = slate, in-flight = blue, anything needing a human = amber,
done = green, killed = red.

## 3. Priority color system (4 levels)

Cool→warm escalation, each ≥4.5:1 as text on white. Rendered by `PriorityPill`
via `var(--color-priority-<priority>)`.

| Priority | Hex       | On white | Family |
| -------- | --------- | -------- | ------ |
| low      | `#64748b` | 4.76:1   | slate  |
| medium   | `#1d4ed8` | 6.70:1   | blue   |
| high     | `#b45309` | 5.02:1   | amber  |
| critical | `#b91c1c` | 6.47:1   | red    |

---

## 4. Primitives

### 4.1 StatusBadge / PriorityPill (shared `TokenPill` anatomy)

One anatomy (`components/ui/token-pill.tsx`): **tinted background (10%) + 6px
status dot + readable label**, at a consistent 24px height and full radius, with
a soft (28%) hairline border — all derived from a single color token.

```tsx
<StatusBadge status="in_progress" />
<PriorityPill priority="critical" />
```

- ✅ **Do** feed pills from the status/priority tokens; let them derive tint,
  border, and dot from the one color.
- ✅ **Do** use `TokenPill` directly only for non-status semantic chips (e.g. the
  workload "Level" indicator → `var(--color-danger/warning/success)`).
- ❌ **Don't** hand-roll a `<span class="rounded-full border …">` per page.
- ❌ **Don't** introduce per-status hex values in component code.

### 4.2 Card / KpiCard

`Card` keeps the shadcn header/body/footer anatomy (`CardHeader`, `CardContent`,
`CardFooter`, `CardTitle`, …) on a hairline surface with `shadow-sm`. **KpiCard**
(`components/ui/kpi-card.tsx`) is a presentational variant: icon chip + label +
big `tabular-nums` number + optional `trend` slot + optional `hint`.

```tsx
<KpiCard label="Active tasks" value={17} icon={ListTodo} trend="+3" />
<KpiCard label="Completed" value={42} icon={CheckCircle2}
         accent="var(--color-success)" trend="+12%" />
```

- ✅ **Do** pass already-computed values; KpiCard is presentational only.
- ❌ **Don't** fetch data inside it or add chart logic.
- _Note:_ `components/charts/kpi-card` stays for current dashboards and migrates
  to this one in a later phase.

### 4.3 PageHeader

`components/layout/page-header.tsx` — title + one-line description (left),
primary-action slot (right), and an optional filter/segment slot below
(`children`).

```tsx
<PageHeader
  title="Workload"
  subtitle="Active capacity and utilization"
  actions={<Button size="sm">Export CSV</Button>}
>
  <TaskFilters />
</PageHeader>
```

- ✅ **Do** keep the description to one line; put filters in the `children` slot.
- ❌ **Don't** stack multiple primary actions — one primary, the rest secondary.

### 4.4 EmptyState

`components/ui/empty-state.tsx` — optional icon + headline + one-line guidance +
optional `action` slot, centered on a dashed hairline surface. Presentational
(server-renderable); the caller supplies the action node.

```tsx
<EmptyState
  title="No tasks found"
  description="Try adjusting your filters."
  action={
    <Button asChild>
      <Link href="/tasks/new">New task</Link>
    </Button>
  }
/>
```

### 4.5 Skeletons

`components/ui/skeletons.tsx` — `TableRowSkeleton`, `KpiCardSkeleton`,
`ChartSkeleton`, shaped to match the primitives above. Use inside Suspense
fallbacks so the loading shape mirrors the loaded content.

### 4.6 Buttons (hierarchy)

`components/ui/button.tsx` (token-aligned, variants unchanged):

| Variant       | Use                     | Token                    |
| ------------- | ----------------------- | ------------------------ |
| `default`     | the one primary action  | `bg-primary` (burgundy)  |
| `secondary`   | secondary emphasis      | `bg-secondary` (navy)    |
| `outline`     | low-emphasis / toolbar  | border + `bg-background` |
| `ghost`       | tertiary / icon actions | hover `bg-accent`        |
| `destructive` | irreversible actions    | `bg-destructive`         |
| `link`        | inline navigation       | `text-primary`           |

- ✅ **Do** keep exactly one `default` (primary) per view.
- All variants use the shared focus ring (`ring-ring/50`).

---

## 5. Sidebar pattern

Executive, Linear/Vercel-style — not consumer pill navigation.

- **Desktop:** persistent left sidebar, **240px**, collapsible to **64px**
  icon-only (labels become tooltips). Width animates with
  `transition-[width]`, suppressed under `prefers-reduced-motion`.
- **Mobile:** hidden sidebar; top bar with a hamburger opens a **Sheet** drawer
  with the same grouped nav. Tapping a nav item closes it.
- **Brand lockup:** the header is a defined `BrandLockup` zone — a logo-mark
  slot (placeholder, swap for the logo file) + wordmark; collapses to the mark.
- **Active route:** `--sidebar-accent` (light burgundy `#f5ecf1`) tint with a
  2px burgundy left border, identical across expanded / collapsed / drawer.
- **Surface:** cool near-white sidebar (slate-50) with a right hairline border.

### 5.1 Navigation IA (role-aware sections)

The flat nav is grouped into four sections. Visibility derives **purely** from
the session's resolved permission set (`canSeeNavItem`) — there is no role→item
map, so the nav can never grant or hide access the route guards / RLS don't
already. Empty sections are not rendered (no disabled rows). Section labels are
muted small-caps (`text-fg-muted`, `text-xs`, `uppercase`).

Each item's permission key **mirrors its route guard exactly**. Where a guard
accepts more than one key (`read` OR `read_all`), the item lists both (any-of).

| Section        | Item          | Route           | Permission (mirrors guard)                   | Visible to     |
| -------------- | ------------- | --------------- | -------------------------------------------- | -------------- |
| Work           | Dashboard     | /dashboard      | `dashboard.view` (page: authed-only)         | all 4          |
| Work           | Tasks         | /tasks          | `tasks.read` (page: authed-only)             | emp, sh, admin |
| Work           | Approvals     | /approvals      | `tasks.approve`                              | sh, admin      |
| Work           | Notifications | /notifications  | `notifications.read` (page: authed)          | all 4          |
| Oversight      | Workload      | /workload       | `workload.read` \| `workload.read_all`       | all 4          |
| Oversight      | Performance   | /performance    | `performance.read` \| `performance.read_all` | all 4          |
| Oversight      | Recurring     | /recurring      | `recurring.manage`                           | sh, admin      |
| Insight        | Reports       | /reports        | `reports.read`                               | emp, sh, admin |
| Administration | Users         | /admin/users    | `users.read`                                 | sh, admin      |
| Administration | Settings      | /admin/settings | `settings.read`                              | sh, admin      |
| Administration | Audit         | /admin/audit    | `audit.read`                                 | sh, admin      |

_(emp = employee, sh = section_head.)_ Resulting per-role nav:

- **employee:** Work (Dashboard, Tasks, Notifications), Oversight (Workload,
  Performance), Insight (Reports).
- **section_head:** all sections, all items.
- **admin:** all sections, all items (admin holds every permission).
- **ceo:** Work (Dashboard, Notifications), Oversight (Workload, Performance).

> **This table mirrors the existing guards, not a separate intent.** The seed
> grants `section_head` the Administration permissions (`users.read`,
> `settings.read`, `audit.read`) and grants `ceo` the `*_all` oversight reads
> but **not** `reports.read` (the Reports guard's key). The nav reflects that
> exactly: it hides only what a role's guard already denies, and shows nothing a
> role can't reach. Aligning the nav to a different intent would require editing
> permissions/guards — out of scope for this design phase.

### 5.2 Collapsed, tooltip & breadcrumb patterns

- **Collapsed (64px):** section labels are hidden and replaced by a hairline
  divider between groups; each icon gets a keyboard-reachable Radix **Tooltip**
  with its label (`side="right"`).
- **Focus:** every nav item shows `focus-visible:ring-2 ring-ring/50` (the
  Phase 1 burgundy ring) in both expanded and collapsed states.
- **Landmarks:** `<nav aria-label="Primary">`; each section is a labelled
  `role="group"` containing a `role="list"` of items.
- **Breadcrumbs:** nested/detail routes (e.g. task detail) render a shadcn
  `Breadcrumb` via the `PageHeader` `breadcrumb` slot — derived from the route,
  no data added.

---

## 6. Component library (shadcn/ui, New York)

`src/components/ui/`: `button`, `card`, `badge`, `avatar`, `dropdown-menu`,
`separator`, `sheet`, `skeleton`, `tooltip`, `input`, `label`, `form`,
`scroll-area`, `table`, `progress`, `select`, `tabs`, `dialog`, `textarea`,
`breadcrumb`, `sonner`. **Phase 1 primitives:** `token-pill`, `status-badge`,
`priority-pill`, `kpi-card`, `empty-state`, `skeletons`. **Layout / nav:**
`app-shell`, `app-sidebar`, `app-topbar`, `app-nav`, `nav-config`,
`brand-lockup`, `page-header`.

- **Style:** New York (Radix-based), pinned in `components.json`.
- **Icons:** `lucide-react`. **Toasts:** `sonner`. **tailwind-merge** stays on
  **3.x** (Tailwind v4-aware). No `@tremor/react`.
