/**
 * seed-dashboard-sample-min.ts — COMPACT single-snapshot sample data.
 *
 * Builds ONE current-week dashboard_snapshots row for the three active business
 * lines (merapp, artc, driving-school) with minimal KPIs and empty charts/tables
 * arrays, validates it against the canonical Zod DashboardData schema (the same
 * schema getLatestSnapshot uses), and writes a small, paste-on-a-phone SQL file:
 *
 *   supabase/sample-data/weekly-dashboard-sample-min.sql
 *
 * Run (Node 22+, no deps): node scripts/seed-dashboard-sample-min.ts
 * Writes a FILE only — it never touches a database.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  dashboardDataSchema,
  type DashboardData,
} from "../src/lib/validations/dashboard.ts";

const SENTINEL = "sample-seed";

// The three active business lines (slugs match the logo filenames).
const LINES = [
  { id: "merapp", name: "Merapp", accent: "#762651" },
  { id: "artc", name: "ARTC", accent: "#193560" },
  { id: "driving-school", name: "SDS", accent: "#0E7490" },
];

// Minimal, plausible KPI values per line (kept tiny on purpose).
const KPIS: Record<string, { rev: [string, string, string]; ot: [string, string, string] }> = {
  merapp: { rev: ["SAR 1.2M", "SAR 4.8M", "SAR 52M"], ot: ["94%", "95%", "93%"] },
  artc: { rev: ["SAR 0.6M", "SAR 2.4M", "SAR 27M"], ot: ["88%", "90%", "89%"] },
  "driving-school": { rev: ["SAR 0.4M", "SAR 1.6M", "SAR 18M"], ot: ["96%", "95%", "96%"] },
};

const now = new Date();
const weekStart = new Date(
  Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
)
  .toISOString()
  .slice(0, 10);

const data: DashboardData = {
  meta: {
    title: "Weekly Business Lines Dashboard",
    subtitle: `Week of ${weekStart} · sample data`,
    lastRefreshed: weekStart,
    weekStart,
    periods: [
      { id: "week", label: "Week" },
      { id: "mtd", label: "MTD" },
      { id: "ytd", label: "YTD" },
    ],
    defaultBl: "merapp",
    defaultPeriod: "week",
    footLeft: "Sample data — generated for preview",
    footRight: `Generated ${weekStart}`,
  },
  businessLines: LINES.map((line) => {
    const k = KPIS[line.id]!;
    return {
      id: line.id,
      name: line.name,
      accent: line.accent,
      isSample: true,
      kpiGroups: [
        {
          num: 1,
          title: "Summary",
          kpis: [
            {
              id: `${line.id}-revenue`,
              label: "Revenue",
              values: { week: k.rev[0], mtd: k.rev[1], ytd: k.rev[2] },
              rag: "green",
            },
            {
              id: `${line.id}-on-time`,
              label: "On-time Delivery",
              values: { week: k.ot[0], mtd: k.ot[1], ytd: k.ot[2] },
              rag: "amber",
            },
          ],
        },
      ],
      charts: [],
      tables: [],
    };
  }),
};

// Validate against the real schema — fail loudly if invalid.
const parsed = dashboardDataSchema.safeParse(data);
if (!parsed.success) {
  console.error("✗ Snapshot FAILED Zod validation:");
  console.error(JSON.stringify(parsed.error.issues, null, 2));
  process.exit(1);
}

const json = JSON.stringify(parsed.data).replace(/'/g, "''");

const sql = `-- Compact single-snapshot sample data for the Business Lines dashboard.
-- One current-week snapshot (${weekStart}); lines: merapp, artc, driving-school.
-- Paste into the Supabase SQL editor. Safe to re-run (replaces the sample row).
-- Remove with: delete from public.dashboard_snapshots where raw_file_path = '${SENTINEL}';
begin;
delete from public.dashboard_snapshots where raw_file_path = '${SENTINEL}';
insert into public.dashboard_snapshots (week_start, data, uploaded_by, task_id, raw_file_path)
values (
  '${weekStart}',
  '${json}'::jsonb,
  (select id from public.profiles where role = 'admin' limit 1),
  null,
  '${SENTINEL}'
);
commit;
`;

const here = dirname(fileURLToPath(import.meta.url));
const outPath = join(
  here,
  "..",
  "supabase",
  "sample-data",
  "weekly-dashboard-sample-min.sql",
);
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, sql);

console.log(
  `✓ Validated 1 snapshot (week ${weekStart}, ${LINES.length} lines, ${data.businessLines[0]!.kpiGroups[0]!.kpis.length} KPIs/line, empty charts/tables).`,
);
console.log("✓ Wrote supabase/sample-data/weekly-dashboard-sample-min.sql");
