# Weekly Dashboard — Excel upload template

The weekly dashboard is produced upstream (already-aggregated numbers) and
delivered to BCPlanner as **one clean `.xlsx` workbook**. The assignee uploads it
from their weekly "Dashboard Update" task; BCPlanner parses it into the canonical
`DASHBOARD_DATA` shape, validates it, and stores a snapshot.

A ready-to-fill blank is at **`docs/templates/weekly-dashboard-template.xlsx`**
(regenerate with `node scripts/gen-dashboard-template.mjs`).

> Rules of thumb: every sheet has a **header row** (row 1). `KPIs`/`Charts`/
> `Tables`/`T_*` may repeat the `business_line_id`. Charts/Tables are optional —
> a partial workbook still renders.

## `Meta` (Field, Value)

| Field            | Example              | Notes                               |
| ---------------- | -------------------- | ----------------------------------- |
| `week_start`     | `2026-06-01`         | ISO date; the snapshot key          |
| `title`          | TSS Weekly Dashboard |                                     |
| `subtitle`       | Week of 1 Jun 2026   |                                     |
| `last_refreshed` | 2026-06-01 09:00     |                                     |
| `foot_left`      | Confidential         |                                     |
| `foot_right`     | Generated weekly     |                                     |
| `default_bl`     | `tss`                | id of the business line shown first |
| `default_period` | `week`               | `week` \| `mtd` \| `ytd`            |

## `BusinessLines`

`id, name, accent, is_sample, order` — one row per line. `accent` is a hex
colour; `is_sample` is `Y`/`N`; `order` sorts the logo filter row.

## `KPIs`

One row per KPI. Columns:

`business_line_id, group_num, group_title, group_subtitle, group_accent,
group_cols, kpi_id, kpi_label, value_week, value_mtd, value_ytd, delta, rag,
target_value, target_target, target_suffix, note, tag, lead`

- KPIs are **grouped by `(business_line_id, group_title)`**, groups ordered by
  `group_num`; KPIs keep their row order within a group.
- `value_week/mtd/ytd` are **pre-formatted strings** (e.g. `SAR 98K`, `32%`).
- `rag` ∈ `green | amber | red`.
- `target_*` are optional; provide `target_value` + `target_target` together
  (numeric) plus an optional `target_suffix` to render a progress target.
- `note`, `tag`, `lead` are optional.

## `Charts`

One row per data point. Columns:

`business_line_id, chart_id, chart_title, chart_type, value_kind, category,
series_name, label, value, color`

- `chart_type` ∈ `groupedBar | doughnut | bar`; `value_kind` ∈ `currency | count`.
- **groupedBar:** uses `category`, `series_name`, `value`, `color`. Distinct
  `category` values (in first-seen order) become the X axis; distinct
  `series_name` values become the series; each series' `data[]` is pivoted from
  the matching `(series_name, category)` cell. `color` is taken per series.
- **doughnut / bar:** each row is a segment — uses `label`, `value`, `color`.

## `Tables` (metadata) + `T_<table_id>` (data)

`Tables`: one row **per column** —
`business_line_id, table_id, table_title, column_order, column_key,
column_label, column_kind`. Columns are ordered by `column_order`.

`column_kind` selects the renderer **and** the cell encoding in the matching
data sheet `T_<table_id>` (whose header row = the column **keys**):

| kind       | cell encoding in `T_<id>`    | parsed to                          |
| ---------- | ---------------------------- | ---------------------------------- |
| `text`     | raw text                     | string                             |
| `num`      | raw number                   | number                             |
| `currency` | raw text (`SAR 98K`)         | string                             |
| `chip`     | `label`                      | `{ label }`                        |
| `rag`      | `level\|label`               | `{ label, level }`                 |
| `minibar`  | `value\|max\|color\|display` | `{ value, max, color?, display? }` |
| `share`    | `pct\|color\|caption`        | `{ pct, color?, caption? }`        |

If the `Tables`/`T_*` sheets are absent, the business line simply has no tables
(best-effort).

## Recurring-task setup (admin)

The upload control appears on a task whose **`category` is exactly
`Dashboard Update`** (the linkage sentinel — no schema change). To run it weekly:

1. **Recurring → New**: title e.g. "Weekly Dashboard Update", **category =
   `Dashboard Update`**, frequency **weekly**, assigned to the dashboard owner.
2. Each week the recurring generator creates a task (inheriting the category);
   the assignee opens it and uploads the workbook from the **Weekly dashboard
   upload** panel on the task detail page.

## Validation & storage

The parser output must pass the `DashboardData` Zod schema
(`src/lib/validations/dashboard.ts`) or the upload is rejected with a precise
field error and **nothing is stored**. On success the raw workbook is saved to
the private `dashboard-uploads` bucket (`dashboard/{week_start}/{uuid}.xlsx`) and
a row is inserted into `dashboard_snapshots` (history kept; the dashboard reads
the most recent). Parsing runs **server-side only** (`exceljs` never ships to the
client bundle).
