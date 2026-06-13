import { z } from "zod";

/**
 * Canonical DASHBOARD_DATA contract (snapshot payload). The Excel parser's
 * output MUST pass this schema or the upload is rejected. Empty charts/tables
 * arrays are valid — partial workbooks still render.
 */

export const ragSchema = z.enum(["green", "amber", "red"]);
export const periodIdSchema = z.enum(["week", "mtd", "ytd"]);

const kpiTargetSchema = z.object({
  value: z.number(),
  target: z.number(),
  suffix: z.string().optional(),
});

/**
 * KPI delta. Legacy snapshots send a plain string (e.g. "+6%"); the new design
 * sends {dir,text}. Both are accepted so existing snapshots still validate.
 */
export const kpiDeltaSchema = z.union([
  z.string(),
  z.object({
    dir: z.enum(["up", "down", "flat"]),
    text: z.string(),
  }),
]);

const kpiSchema = z.object({
  id: z.string(),
  label: z.string(),
  values: z.object({
    week: z.string(),
    mtd: z.string(),
    ytd: z.string(),
  }),
  delta: kpiDeltaSchema.optional(),
  rag: ragSchema,
  note: z.string().optional(),
  target: kpiTargetSchema.optional(),
  tag: z.string().optional(),
  // Hero flag. New design uses a boolean; the existing parser emits a string
  // cell — accept both (truthiness decides), so no parser change is needed.
  lead: z.union([z.boolean(), z.string()]).optional(),
});

const kpiGroupSchema = z.object({
  // Badge text — the design ships zero-padded strings ("01"); legacy snapshots
  // send a number. Accept both (rendered verbatim).
  num: z.union([z.number(), z.string()]),
  title: z.string(),
  subtitle: z.string().optional(),
  accent: z.string().optional(),
  cols: z.number().optional(),
  kpis: z.array(kpiSchema),
});

const seriesSchema = z.object({
  name: z.string(),
  color: z.string(),
  data: z.array(z.number()),
});

// Optional presentation fields shared by every chart (DELTA — absent in legacy
// snapshots): a subtitle and a layout span ("wide" = full-row + taller).
const chartChrome = {
  subtitle: z.string().optional(),
  span: z.enum(["wide", "half"]).optional(),
};

const groupedBarChartSchema = z.object({
  id: z.string(),
  title: z.string(),
  type: z.literal("groupedBar"),
  valueKind: z.enum(["currency", "count"]),
  categories: z.array(z.string()),
  series: z.array(seriesSchema),
  ...chartChrome,
});

// Trend line chart — identical {categories, series[]} shape to groupedBar
// (DELTA §7; needs a stored weekly time series upstream, not in this PR).
const lineChartSchema = z.object({
  id: z.string(),
  title: z.string(),
  type: z.literal("line"),
  valueKind: z.enum(["currency", "count"]),
  categories: z.array(z.string()),
  series: z.array(seriesSchema),
  ...chartChrome,
});

const segmentSchema = z.object({
  label: z.string(),
  value: z.number(),
  color: z.string(),
});

const doughnutChartSchema = z.object({
  id: z.string(),
  title: z.string(),
  type: z.literal("doughnut"),
  valueKind: z.enum(["currency", "count"]),
  segments: z.array(segmentSchema),
  ...chartChrome,
});

const barChartSchema = z.object({
  id: z.string(),
  title: z.string(),
  type: z.literal("bar"),
  valueKind: z.enum(["currency", "count"]),
  segments: z.array(segmentSchema),
  ...chartChrome,
});

export const chartSchema = z.discriminatedUnion("type", [
  groupedBarChartSchema,
  lineChartSchema,
  doughnutChartSchema,
  barChartSchema,
]);

const columnSchema = z.object({
  key: z.string(),
  label: z.string(),
  kind: z.enum(["text", "num", "currency", "chip", "rag", "minibar", "share"]),
  align: z.enum(["left", "right"]).optional(),
  strong: z.boolean().optional(),
});

/**
 * One table cell. Encodings (specific object shapes first so a richer object
 * isn't matched as the simpler one):
 *   minibar → {value,max,color?,display?}; share → {pct,color?,caption?};
 *   rag → {label,level}; chip → {label}; text/num/currency → scalar.
 */
const cellValueSchema = z.union([
  z.object({
    value: z.number(),
    max: z.number(),
    color: z.string().optional(),
    display: z.string().optional(),
  }),
  z.object({
    pct: z.number(),
    color: z.string().optional(),
    caption: z.string().optional(),
  }),
  z.object({ label: z.string(), level: z.string() }),
  z.object({ label: z.string() }),
  z.string(),
  z.number(),
  z.null(),
]);

const tableSchema = z.object({
  id: z.string(),
  title: z.string(),
  meta: z.string().optional(),
  columns: z.array(columnSchema),
  rows: z.array(z.record(z.string(), cellValueSchema)),
});

const businessLineSchema = z.object({
  id: z.string(),
  name: z.string(),
  accent: z.string(),
  isSample: z.boolean(),
  tagline: z.string().optional(),
  kpiGroups: z.array(kpiGroupSchema),
  charts: z.array(chartSchema),
  tables: z.array(tableSchema),
});

const metaSchema = z.object({
  title: z.string(),
  subtitle: z.string(),
  lastRefreshed: z.string(),
  weekStart: z.string(), // ISO date (YYYY-MM-DD)
  periods: z.array(z.object({ id: periodIdSchema, label: z.string() })),
  defaultBl: z.string(),
  defaultPeriod: periodIdSchema,
  footLeft: z.string(),
  footRight: z.string(),
});

export const dashboardDataSchema = z.object({
  meta: metaSchema,
  businessLines: z.array(businessLineSchema),
});

export type DashboardData = z.infer<typeof dashboardDataSchema>;
export type DashboardBusinessLine = z.infer<typeof businessLineSchema>;
export type DashboardChart = z.infer<typeof chartSchema>;
export type DashboardKpi = z.infer<typeof kpiSchema>;
export type Rag = z.infer<typeof ragSchema>;
export type PeriodId = z.infer<typeof periodIdSchema>;
