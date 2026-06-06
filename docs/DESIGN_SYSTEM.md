# Design System

TSS Planner's executive UI system: shadcn/ui (New York) on Tailwind v4 `@theme`,
TSS brand colors, the task-status palette, typography, and the app-shell pattern.

> **Note on the design spec:** the `ui-ux-pro-max-skill` referenced by the phase
> plan is not installed in this environment. The four specifications below were
> produced directly (contrast figures computed with the WCAG relative-luminance
> formula) and are the implementation blueprint.

## 1. Contrast audit (WCAG)

| Color                      | On                     | Ratio      | Normal text (AA 4.5) | AAA (7) |
| -------------------------- | ---------------------- | ---------- | -------------------- | ------- |
| **TSS Burgundy `#762651`** | white `#ffffff`        | **9.7:1**  | ✅ Pass              | ✅ Pass |
| TSS Burgundy `#762651`     | light gray `#F8F8F8`   | **9.1:1**  | ✅ Pass              | ✅ Pass |
| White `#ffffff`            | TSS Burgundy `#762651` | **9.7:1**  | ✅ Pass              | ✅ Pass |
| **SAPTCO Navy `#193560`**  | white `#ffffff`        | **12.2:1** | ✅ Pass              | ✅ Pass |

**Result:** `#762651` is fully WCAG AAA on both white and `#F8F8F8` for normal
text, and white-on-burgundy buttons pass AAA. **No adjustment needed** — the
brand burgundy is used as-is for `--primary`. SAPTCO Navy passes AAA on white and
is used as-is for `--secondary`.

## 2. Sidebar pattern

Executive, Linear/Vercel-style — not consumer pill navigation.

- **Desktop:** persistent left sidebar, **240px**, collapsible to **64px**
  icon-only via a toggle. Icon-only mode shows labels as tooltips.
- **Mobile:** hidden sidebar; a top bar with a hamburger opens a **Sheet**
  (slide-in drawer from the left) containing the same navigation. Tapping a nav
  item closes the drawer.
- **Grouping:** a primary (ungrouped) section plus labelled groups
  **Reports & Analysis** and **Administration**. Group labels are uppercase,
  muted, small.
- **Active route:** tinted background (`--sidebar-accent`, a light burgundy
  `#f5ecf1`) with a 2px burgundy left border.
- **User section (bottom):** avatar (initials fallback, burgundy), full name,
  role badge, and a sign-out button. On mobile the user/sign-out lives in the
  top-bar avatar dropdown.
- **Surface:** near-white sidebar `#fafafa` with a right border.

## 3. Status badge system (12 task statuses)

Each status maps to a `--color-status-<status>` token in `@theme`
(`src/app/globals.css`). The `StatusBadge` component renders colored text + a 1px
border + a 10% tint background (`color-mix`). All hues are Tailwind 600/700-level
and meet ≥4.5:1 as text on white.

| Status                    | Color name | Hex       | Token                                      |
| ------------------------- | ---------- | --------- | ------------------------------------------ |
| draft                     | slate      | `#475569` | `--color-status-draft`                     |
| pending_approval          | amber      | `#b45309` | `--color-status-pending_approval`          |
| approved                  | teal       | `#0f766e` | `--color-status-approved`                  |
| assigned                  | blue       | `#1d4ed8` | `--color-status-assigned`                  |
| in_progress               | indigo     | `#4338ca` | `--color-status-in_progress`               |
| pending_update            | orange     | `#c2410c` | `--color-status-pending_update`            |
| pending_review            | violet     | `#7c3aed` | `--color-status-pending_review`            |
| completed                 | green      | `#15803d` | `--color-status-completed`                 |
| rejected                  | red        | `#b91c1c` | `--color-status-rejected`                  |
| returned_for_modification | pink       | `#be185d` | `--color-status-returned_for_modification` |
| cancelled                 | stone      | `#57534e` | `--color-status-cancelled`                 |
| reopened                  | cyan       | `#0e7490` | `--color-status-reopened`                  |

## 4. Typography scale (Inter)

| Level   | Size               | Weight | Line height |
| ------- | ------------------ | ------ | ----------- |
| h1      | 30px (`text-3xl`)  | 600    | 1.2         |
| h2      | 24px (`text-2xl`)  | 600    | 1.3         |
| h3      | 20px (`text-xl`)   | 600    | 1.4         |
| body    | 16px (`text-base`) | 400    | 1.5         |
| small   | 14px (`text-sm`)   | 400    | 1.5         |
| label   | 14px (`text-sm`)   | 500    | 1.4         |
| caption | 12px (`text-xs`)   | 400    | 1.4         |

h1–h3 defaults are applied in the `@layer base` block; element utility classes
override them.

## Brand → shadcn token mapping

Set in `:root` in `src/app/globals.css`:

- `--primary: #762651` / `--primary-foreground: #ffffff` (TSS Burgundy)
- `--secondary: #193560` / `--secondary-foreground: #ffffff` (SAPTCO Navy)
- `--ring: #762651`, `--chart-1: #762651`, `--chart-2: #193560`
- Sidebar: `--sidebar: #fafafa`, `--sidebar-primary: #762651`,
  `--sidebar-accent: #f5ecf1`, `--sidebar-accent-foreground: #762651`
- Neutral gray scale, semantic `success/warning/danger/info`, and the 12 status
  tokens live in the `@theme` block.

## Component library (shadcn/ui, New York)

Installed in `src/components/ui/`: `button`, `card`, `badge`, `avatar`,
`dropdown-menu`, `separator`, `sheet`, `skeleton`, `tooltip`, `input`, `label`,
`form`, `scroll-area`, and `sonner` (toasts). Plus app components: `status-badge`,
`empty-state`, and the layout set (`app-shell`, `app-sidebar`, `app-topbar`,
`app-nav`, `page-header`, `coming-soon`).

- **Style:** New York (Radix-based). The CLI's current default is `base-nova`
  (Base UI); we explicitly pinned `new-york` in `components.json`.
- **Icons:** `lucide-react`. **Toasts:** `sonner` (`<Toaster />` mounted once in
  the app shell). **tailwind-merge** stays on **3.x** (Tailwind v4-aware).

## Swapping in Frutiger LT Arabic

When the official font files are supplied:

1. Add the font (e.g. `next/font/local`) exposing a CSS variable.
2. Point `--font-inter` (or replace it) at the new font in `src/app/layout.tsx`.
3. The `@theme` `--font-sans` token already drives `font-sans` app-wide, so no
   component changes are needed.
