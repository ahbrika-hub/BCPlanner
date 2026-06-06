# Module: Analytics & Insights

Role-based dashboards, reports (filters + charts + CSV export), and performance
evaluations. All aggregation runs under RLS, so each user only sees data they're
permitted to. Charts theme entirely from the TSS brand + status CSS variables
(no second color system).

## Charts (`src/components/charts/`)

shadcn `chart` + **recharts**. Wrappers: `KpiCard`, `StatusDistributionChart`
(donut, `--color-status-*`), `TasksOverTimeChart` (area; created vs completed,
`--secondary`/`--primary`), `BarComparisonChart` (bar, `--primary` default).

## Aggregation data layer (`src/lib/data/`)

- `analytics.ts` — `getDashboardStats` (totals, by-status/priority, completion
  rate, overdue, pending approvals/review, avg quality), `getStatusDistribution`,
  `getTasksByBusinessLine`, `getCompletionTrend` (monthly), `getOverdueTasks`,
  `getRecentActivity`. Optional `assigneeId` scope for personal dashboards.
- `performance.ts` — `computeEmployeeMetrics`, `listEvaluations`, `getEvaluation`,
  `createEvaluation`, `updateEvaluation`, `listEvaluableEmployees`. Re-exports the
  pure `calculatePerformanceScore`.
- `reports.ts` — `getReportData(filters)` → filtered tasks + summary aggregates.

## Performance formula (40/30/30)

`src/lib/performance/score.ts` (pure, unit-tested):

```
overall = (completed/total)*40 + (qualityAvg/5)*30 + (1 − delayed/total)*30
```

- `total` = assigned tasks in the period; `completed` = closed; `delayed` =
  completed after `due_date` (or open past due); `qualityAvg` = avg `quality_rating`.
- `total = 0` → returns `0` (no divide-by-zero). Rounded to one decimal.
- **Worked example:** total 10, completed 8, delayed 2, quality 4.0 →
  `32 + 24 + 24 = 80.0` (verified). `ScoreBreakdown` renders each contribution so
  the score is explainable.
- Period labels are `YYYY-Qn` (`src/lib/performance/period.ts`).

## Pages

- **`/dashboard`** — role-based: CEO → executive (org KPIs, status donut, by-line
  bar, completion trend, team scores; **read-only, no action buttons**);
  section_head/admin → operational (approval/review/active/overdue KPIs, workload
  snapshot, charts, overdue + recent activity); employee → personal (my KPIs,
  tasks needing action, recent notifications, my score).
- **`/reports`** — `reports.read` (own) / `reports.read_all` (all). Server-side
  filters (date range, business line, status), summary KPIs, three charts, task
  table, and **Export CSV** (client-side from the fetched rows).
- **`/performance`** — `performance.read` (own) / `performance.read_all` (team).
  Personal: current-period `ScoreBreakdown` + history. Manager: team evaluation
  table + (with `performance.evaluate`) the **New Evaluation** dialog, which
  computes metrics via `previewMetricsAction` and saves through
  `createEvaluationAction` (server recomputes authoritatively).

## Validation

`calculatePerformanceScore` unit-verified (80 / 0 / 100). `typecheck`/`lint`/
`build` pass. recharts installed; tailwind-merge stays 3.x. Role-gating enforced
both by RLS (scope) and per-page permission checks. Multi-role interactive
verification (CEO vs section_head vs employee layouts, live charts) should be
confirmed on the deployed app with seeded users.
