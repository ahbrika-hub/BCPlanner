/**
 * seed-dashboard-sample.ts — generate VALIDATED dummy weekly-snapshot data.
 *
 * Builds ~one DASHBOARD_DATA snapshot per week from 2026-01-01 to today, one
 * entry per business line, validates EVERY snapshot against the canonical Zod
 * schema (fails loudly on any miss), then emits two runnable SQL files for the
 * owner to apply manually:
 *
 *   supabase/sample-data/weekly-dashboard-sample.sql          (idempotent INSERTs)
 *   supabase/sample-data/weekly-dashboard-sample-cleanup.sql  (sentinel DELETE)
 *
 * Run (Node 22+, no extra deps — native TS strip-types):
 *   node scripts/seed-dashboard-sample.ts
 *
 * This script writes FILES only. It never connects to any database and never
 * touches production. Applying the SQL is a separate, manual step.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  dashboardDataSchema,
  type DashboardData,
} from "../src/lib/validations/dashboard.ts";

// ── config ───────────────────────────────────────────────────────────────────

const SENTINEL = "sample-seed";
const START = Date.UTC(2026, 0, 1); // 2026-01-01
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** Business-line slugs MUST match the logo filenames (public/business-lines/<id>). */
const LINES: { id: string; name: string; accent: string }[] = [
  { id: "merapp", name: "Merapp", accent: "#762651" },
  { id: "artc", name: "ARTC", accent: "#193560" },
  { id: "driving-school", name: "SDS", accent: "#0E7490" },
  { id: "tss", name: "TSS", accent: "#B45309" },
  { id: "dealership", name: "Dealership", accent: "#15803D" },
  { id: "corporate", name: "Corporate", accent: "#6D28D9" },
  { id: "general", name: "General", accent: "#475569" },
];

// ── deterministic PRNG (stable output for the same date) ──────────────────────

function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), seed | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const randInt = (rng: () => number, min: number, max: number) =>
  Math.floor(rng() * (max - min + 1)) + min;

const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

const sar = (n: number) =>
  n >= 1_000_000
    ? `SAR ${(n / 1_000_000).toFixed(1)}M`
    : `SAR ${Math.round(n / 1000)}K`;

function ragFromPct(pct: number): "green" | "amber" | "red" {
  return pct >= 90 ? "green" : pct >= 75 ? "amber" : "red";
}

// ── snapshot builder ──────────────────────────────────────────────────────────

function buildBusinessLine(
  weekIdx: number,
  line: { id: string; name: string; accent: string },
  lineIdx: number,
): DashboardData["businessLines"][number] {
  const rng = mulberry32(weekIdx * 1000 + lineIdx * 17 + 1);

  const revenue = randInt(rng, 600_000, 3_400_000);
  const revTarget = revenue + randInt(rng, -200_000, 400_000);
  const activeTasks = randInt(rng, 8, 64);
  const onTime = randInt(rng, 68, 99);
  const csat = randInt(rng, 70, 98);
  const completed = randInt(rng, 10, 50);
  const inProgress = randInt(rng, 5, 30);
  const blocked = randInt(rng, 0, 8);

  const mtdMul = 3 + (weekIdx % 4);
  const ytdMul = 8 + weekIdx;

  return {
    id: line.id,
    name: line.name,
    accent: line.accent,
    isSample: true,
    kpiGroups: [
      {
        num: 1,
        title: "Performance",
        subtitle: "Operational KPIs (sample data)",
        kpis: [
          {
            id: `${line.id}-revenue`,
            label: "Revenue",
            values: {
              week: sar(revenue),
              mtd: sar(revenue * mtdMul),
              ytd: sar(revenue * ytdMul),
            },
            delta: `${rng() > 0.5 ? "+" : "-"}${randInt(rng, 1, 18)}%`,
            rag: ragFromPct(Math.round((revenue / revTarget) * 100)),
            note: "vs target",
            target: {
              value: Math.round(revenue / 1000),
              target: Math.round(revTarget / 1000),
              suffix: "K",
            },
          },
          {
            id: `${line.id}-active-tasks`,
            label: "Active Tasks",
            values: {
              week: String(activeTasks),
              mtd: String(activeTasks + randInt(rng, 4, 20)),
              ytd: String(activeTasks * ytdMul),
            },
            delta: `${rng() > 0.5 ? "+" : "-"}${randInt(rng, 1, 9)}`,
            rag: "green",
            note: "open this week",
          },
          {
            id: `${line.id}-on-time`,
            label: "On-time Delivery",
            values: {
              week: `${onTime}%`,
              mtd: `${Math.min(100, onTime + randInt(rng, -3, 4))}%`,
              ytd: `${Math.min(100, onTime + randInt(rng, -5, 2))}%`,
            },
            delta: `${rng() > 0.5 ? "+" : "-"}${randInt(rng, 1, 6)}%`,
            rag: ragFromPct(onTime),
          },
          {
            id: `${line.id}-csat`,
            label: "Customer Satisfaction",
            values: {
              week: `${csat}%`,
              mtd: `${Math.min(100, csat + randInt(rng, -2, 3))}%`,
              ytd: `${Math.min(100, csat + randInt(rng, -4, 2))}%`,
            },
            delta: `${rng() > 0.5 ? "+" : "-"}${randInt(rng, 1, 5)}%`,
            rag: ragFromPct(csat),
            target: { value: csat, target: 95, suffix: "%" },
          },
        ],
      },
    ],
    charts: [
      {
        id: `${line.id}-revenue-trend`,
        title: "Revenue vs Target",
        type: "groupedBar",
        valueKind: "currency",
        categories: ["Wk 1", "Wk 2", "Wk 3", "Wk 4"],
        series: [
          {
            name: "Actual",
            color: line.accent,
            data: Array.from({ length: 4 }, () => randInt(rng, 400, 1200)),
          },
          {
            name: "Target",
            color: "#94a3b8",
            data: Array.from({ length: 4 }, () => randInt(rng, 500, 1100)),
          },
        ],
      },
      {
        id: `${line.id}-task-mix`,
        title: "Task Status Mix",
        type: "doughnut",
        valueKind: "count",
        segments: [
          { label: "Completed", value: completed, color: "#15803D" },
          { label: "In Progress", value: inProgress, color: "#B45309" },
          { label: "Blocked", value: blocked, color: "#B91C1C" },
        ],
      },
    ],
    tables: [
      {
        id: `${line.id}-engagements`,
        title: "Top Engagements",
        columns: [
          { key: "name", label: "Engagement", kind: "text" },
          { key: "progress", label: "Progress", kind: "minibar" },
          { key: "health", label: "Health", kind: "rag" },
          { key: "value", label: "Value", kind: "currency" },
        ],
        rows: Array.from({ length: 4 }, (_, i) => {
          const pct = randInt(rng, 20, 100);
          const level = pct >= 80 ? "green" : pct >= 50 ? "amber" : "red";
          return {
            name: `${line.name} Engagement ${i + 1}`,
            progress: { value: pct, max: 100, display: `${pct}%` },
            health: { label: level.toUpperCase(), level },
            value: sar(randInt(rng, 80_000, 900_000)),
          };
        }),
      },
    ],
  };
}

function buildSnapshot(weekIdx: number, weekStartMs: number): DashboardData {
  const weekStart = iso(weekStartMs);
  return {
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
      defaultBl: LINES[0]!.id,
      defaultPeriod: "week",
      footLeft: "Sample data — generated for preview",
      footRight: `Generated ${iso(Date.now())}`,
    },
    businessLines: LINES.map((line, i) => buildBusinessLine(weekIdx, line, i)),
  };
}

// ── generate + validate ───────────────────────────────────────────────────────

// Anchor the cadence on today and step back one week at a time to 2026-01-01,
// so the most recent snapshot is dated today (the Business Lines view reads the
// latest snapshot).
const now = new Date();
const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
const weekStartsMs: number[] = [];
for (let ms = today; ms >= START; ms -= WEEK_MS) weekStartsMs.push(ms);
weekStartsMs.reverse();

const snapshots: { weekStart: string; data: DashboardData }[] = [];

weekStartsMs.forEach((ms, weekIdx) => {
  const data = buildSnapshot(weekIdx, ms);
  const parsed = dashboardDataSchema.safeParse(data);
  if (!parsed.success) {
    console.error(
      `\n✗ VALIDATION FAILED for week ${iso(ms)}:\n`,
      JSON.stringify(parsed.error.issues, null, 2),
    );
    process.exit(1);
  }
  snapshots.push({ weekStart: iso(ms), data: parsed.data });
});

if (snapshots.length === 0) {
  console.error("✗ No snapshots generated — check the date range.");
  process.exit(1);
}

// ── emit SQL ──────────────────────────────────────────────────────────────────

const sqlEscape = (s: string) => s.replace(/'/g, "''");

// uploaded_by: resolve a real admin profile at apply-time. The owner may replace
// this subquery with a specific admin UUID if preferred.
const UPLOADED_BY =
  "(select id from public.profiles where role = 'admin' order by created_at asc limit 1)";

const valueRows = snapshots
  .map(
    (s) =>
      `  ('${s.weekStart}', '${sqlEscape(JSON.stringify(s.data))}'::jsonb, ${UPLOADED_BY}, null, '${SENTINEL}')`,
  )
  .join(",\n");

const mainSql = `-- Weekly dashboard SAMPLE data — ${snapshots.length} snapshots (${snapshots[0]!.weekStart} → ${snapshots.at(-1)!.weekStart}).
-- GENERATED by scripts/seed-dashboard-sample.ts. Every snapshot was validated
-- against the canonical Zod DashboardData schema before this file was written.
--
-- SAFE TO RE-RUN: it first removes any existing rows tagged with the
-- raw_file_path sentinel ('${SENTINEL}'), then re-inserts. It NEVER touches
-- real uploads (those have a 'dashboard/...' raw_file_path).
--
-- Apply with the SQL editor / psql as an admin (service role / postgres).
-- To remove: run supabase/sample-data/weekly-dashboard-sample-cleanup.sql.

begin;

delete from public.dashboard_snapshots where raw_file_path = '${SENTINEL}';

insert into public.dashboard_snapshots
  (week_start, data, uploaded_by, task_id, raw_file_path)
values
${valueRows};

commit;
`;

const cleanupSql = `-- Remove the weekly dashboard SAMPLE data inserted by
-- supabase/sample-data/weekly-dashboard-sample.sql. Affects ONLY sentinel rows.
delete from public.dashboard_snapshots where raw_file_path = '${SENTINEL}';
`;

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "..", "supabase", "sample-data");
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "weekly-dashboard-sample.sql"), mainSql);
writeFileSync(join(outDir, "weekly-dashboard-sample-cleanup.sql"), cleanupSql);

console.log(
  `✓ Validated ${snapshots.length} snapshots (${snapshots[0]!.weekStart} → ${snapshots.at(-1)!.weekStart}), ${LINES.length} business lines each.`,
);
console.log("✓ Wrote supabase/sample-data/weekly-dashboard-sample.sql");
console.log("✓ Wrote supabase/sample-data/weekly-dashboard-sample-cleanup.sql");
