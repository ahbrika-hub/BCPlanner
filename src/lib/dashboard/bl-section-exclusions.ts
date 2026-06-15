import type { DashboardData } from "@/lib/validations/dashboard";

/**
 * Render-time, slug-keyed removal of specific per-line dashboard sections.
 *
 * The weekly/business-lines dashboard is snapshot-driven: it renders from each
 * line's DASHBOARD_DATA (`kpiGroups[]`, `charts[]`, `tables[]`). render() already
 * hides a section whose array is empty, so emptying the matching array makes the
 * "Analysis Charts" / "Detail Tables" section disappear for that line — durably,
 * across future real workbook uploads, without touching seeds or business_lines.
 *
 * Keyed by SLUG (DASHBOARD_DATA `businessLines[].id` = tss/merapp/artc/
 * driving-school — NOT the per-env `business_lines.id` UUID).
 */

type BusinessLine = DashboardData["businessLines"][number];
type Entry = { id: string; title: string };

/** Selects chart/table entries to REMOVE from a line's section. */
export type Matcher =
  | { title: string } // case-insensitive, trimmed title match
  | { id: string } // exact id match
  | { all: true }; // the whole section (every entry)

type LineExclusions = { charts?: Matcher[]; tables?: Matcher[] };

export const BL_SECTION_EXCLUSIONS: Record<string, LineExclusions> = {
  // merapp: drop only the "Technician KPIs" detail table (keep Branch Performance).
  merapp: { tables: [{ title: "Technician KPIs" }] },
  // artc: drop the entire "Analysis Charts" section (all of the line's charts[]).
  artc: { charts: [{ all: true }] },
};

const norm = (s: string) => s.trim().toLowerCase();

function matches(entry: Entry, m: Matcher): boolean {
  if ("all" in m) return true;
  if ("id" in m) return entry.id === m.id;
  return norm(entry.title) === norm(m.title);
}

function keep<T extends Entry>(items: T[], matchers?: Matcher[]): T[] {
  if (!matchers || matchers.length === 0) return items;
  const next = items.filter((it) => !matchers.some((m) => matches(it, m)));
  // Preserve referential identity when nothing was removed.
  return next.length === items.length ? items : next;
}

/**
 * Pure transform: filter the configured sections out of each business line by
 * slug. Lines without config (and unmatched entries) are returned untouched
 * (same references), so everything else is byte-identical.
 */
export function applyBlSectionExclusions(data: DashboardData): DashboardData {
  let changed = false;
  const businessLines = data.businessLines.map((bl): BusinessLine => {
    const cfg = BL_SECTION_EXCLUSIONS[bl.id];
    if (!cfg) return bl;
    const charts = keep(bl.charts, cfg.charts);
    const tables = keep(bl.tables, cfg.tables);
    if (charts === bl.charts && tables === bl.tables) return bl;
    changed = true;
    return { ...bl, charts, tables };
  });
  return changed ? { ...data, businessLines } : data;
}
