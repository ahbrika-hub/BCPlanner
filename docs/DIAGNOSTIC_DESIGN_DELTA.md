# Diagnostic — Before / After Design Delta

**Read-only diagnostic.** No application source, config, data, or migration was
changed. The only committed artifacts are the montage images in
`docs/assets/diagnostic/` and this document. Both screenshot harnesses and both
git worktrees were removed before commit.

## Verdict

**The four design PRs produced a real, visible change — it landed.** Side-by-side
montages of the _same_ surfaces with _identical_ mock data on pre-design `main`
vs current `main` show clear deltas on every surface checked (status colour
system, app shell / nav IA, executive dashboard, module table, mobile table).
The only gap found is a **partial roll-out**: the `PriorityPill` primitive
defined in Phase 1 was never applied to the task tables, so **priority chips are
unchanged** while status badges were fully harmonized (see Findings §3).

## 1. PRs merged into `main`

Current `main` HEAD: **`cb20731`**. First-parent merge history confirms all four
design PRs (and the audit) are merged:

| PR  | Scope                          | Merged | Merge commit |
| --- | ------------------------------ | ------ | ------------ |
| #14 | tokens + primitives            | ✅ yes | `915f3a1`    |
| #15 | navigation IA + shell          | ✅ yes | `dcf60f3`    |
| #16 | permissions audit (docs-only)  | ✅ yes | `7888b1b`    |
| #17 | dashboard recompose            | ✅ yes | `6ef3dfa`    |
| #18 | responsiveness + a11y + motion | ✅ yes | `cb20731`    |

What is on `main` is what auto-deploys to Vercel, so the deployed app reflects
all four design phases.

## 2. Pre-design baseline

The last commit on `main` **before** PR #14 merged (first parent of `915f3a1`):

- **Commit:** `36e3f3c` — "Merge pull request #13 from …/review/system-audit"
- **Date:** 2026-06-06 23:55:15 +0300

This is the **BEFORE** state in every montage. **AFTER** is current `main`
(`cb20731`).

## 3. Token-adoption check (current `main`)

Grep of `src/` for design-system bypasses:

| Check                                                         | Result                                                    |
| ------------------------------------------------------------- | --------------------------------------------------------- |
| Raw `#rrggbb` hex in `.tsx`                                   | **4 — all in `src/app/global-error.tsx`**                 |
| Hardcoded `gray/zinc/slate/neutral/stone-NNN` utils in `.tsx` | **0**                                                     |
| Same utils in `.ts`                                           | 1 — `src/lib/format.ts` (`text-gray-600 border-gray-300`) |
| Inline `style` spacing (padding/margin/gap)                   | 1 — `src/app/global-error.tsx`                            |

**Interpretation — adoption is effectively complete:**

- **`global-error.tsx`** is the React **root error boundary**. It replaces the
  whole document when the app crashes at the root, so it cannot rely on the
  stylesheet/`@theme` and deliberately inlines a few hex values. This is an
  expected exception, not a surface that "missed" the tokens.
- **`format.ts` `priorityClasses.low`** uses `text-gray-600 / border-gray-300`,
  but `gray-*` is **aliased to the cool-neutral ramp** in `@theme`
  (`--color-gray-600: var(--color-neutral-600)`), so these resolve to design
  tokens — not a bypass. `medium/high/critical` use the semantic
  `info/warning/danger` tokens.

No component or page renders off-token colours. The reason a surface could look
"unchanged" is **not** a token bypass — it is the partial roll-out below.

### Partial roll-out (the one real gap)

`PriorityPill` (the Phase 1 primitive with the tinted-bg + 6px dot anatomy, the
twin of `StatusBadge`) is **defined but never used by the pages**. The tasks
list and task-detail still render priority via
`<Badge variant="outline" className={priorityClasses[...]}>`. Consequently:

- **Status** chips: harmonized hues **+ 6px dot** (changed — see `table.png`).
- **Priority** chips: **identical before/after** — legacy outline badge, no dot,
  not visually unified with the status system.

This is consistent with the phase plans (primitives were defined for a later
roll-out), and it is **not a regression** (priority colours are still
token-backed). It is the surface where the new design "didn't fully land," and a
one-line-per-call swap to `PriorityPill` would close it.

## 4. Per-surface deltas (montages in `docs/assets/diagnostic/`)

| Montage            | BEFORE (`36e3f3c`)                                                                                                                         | AFTER (`cb20731`)                                                                                                                                                 |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `badges.png`       | no dot; full-saturation borders; scattered hues (teal/indigo/violet/pink/cyan)                                                             | 6px dot; soft borders; harmonized lifecycle families (slate/blue/amber/green/red)                                                                                 |
| `shell.png`        | flat nav; plain "TSS Planner" text; 2 group labels                                                                                         | brand lockup (mark + wordmark); **Work / Oversight / Insight / Administration** groups; cool-slate surface                                                        |
| `exec.png`         | donut **without legend** (colour-only); vertical bars, no value labels; area chart no axis/legend; team perf = plain `<ul>` of bare scores | donut **with legend**; **horizontal** bars with value labels; area chart with Y-axis + legend; team perf = **table** with score-band `TokenPill`s; reading column |
| `table.png`        | status badges no dot / scattered hues; priority badge legacy                                                                               | status badges dot + harmonized; **priority badge unchanged** (see §3)                                                                                             |
| `table-mobile.png` | scrolled right → **first column (Task No) scrolls away**                                                                                   | scrolled right → **first column stays pinned** (sticky-first-column)                                                                                              |

## 5. Method

- `git worktree add` for both states (`36e3f3c` and `cb20731`); `npm ci` in each.
- A temporary, component-isolation harness in **each** worktree imported **that
  tree's own** real components/pages and fed them the **same** mock data (so any
  difference is purely presentation). The pre-design tree's monolithic,
  data-fetching executive dashboard was reproduced verbatim in its harness with
  the mock data.
- Matched screenshots (same surface, viewport, data) at desktop 1440 (and mobile
  390 for the table) via Playwright/Chromium; montages composed with a small
  Playwright HTML step (no new dependencies — ImageMagick/Pillow absent).
- Both harnesses and both worktrees were removed before commit; this branch is
  **docs-only**.
