import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock the data + session layers so we can drive the page guard directly and
// let the happy path render without a database.
const session = vi.hoisted(() => ({
  getCurrentProfile: vi.fn(),
  getCurrentPermissions: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => session);
vi.mock("@/lib/data/reports", () => ({
  getReportData: vi.fn(async () => ({
    tasks: [],
    summary: { count: 0, completed: 0, delayed: 0, avgQuality: null },
  })),
}));
vi.mock("@/lib/data/business-lines", () => ({
  listBusinessLines: vi.fn(async () => []),
}));
vi.mock("@/lib/data/profiles", () => ({
  listAssignableUsers: vi.fn(async () => []),
}));

import ReportsPage from "@/app/(app)/reports/page";

// Recursively scan a returned React element tree for an element rendered with
// `title === target` (EmptyState uses a `title` prop).
function hasTitle(node: unknown, target: string): boolean {
  if (!node || typeof node !== "object") return false;
  if (Array.isArray(node)) return node.some((n) => hasTitle(n, target));
  const props = (node as { props?: Record<string, unknown> }).props;
  if (!props) return false;
  if (props.title === target) return true;
  return Object.values(props).some((v) => hasTitle(v, target));
}

const PROFILE = { id: "u1", role: "ceo" } as never;
const searchParams = () => Promise.resolve({});

describe("/reports guard (reports.read OR reports.read_all)", () => {
  beforeEach(() => {
    session.getCurrentProfile.mockReset();
    session.getCurrentPermissions.mockReset();
    session.getCurrentProfile.mockResolvedValue(PROFILE);
  });

  it("CEO (reports.read_all, no reports.read) reaches reports", async () => {
    session.getCurrentPermissions.mockResolvedValue(["reports.read_all"]);
    const tree = await ReportsPage({ searchParams: searchParams() });
    expect(hasTitle(tree, "Access restricted")).toBe(false);
  });

  it("employee (reports.read) reaches reports", async () => {
    session.getCurrentPermissions.mockResolvedValue(["reports.read"]);
    const tree = await ReportsPage({ searchParams: searchParams() });
    expect(hasTitle(tree, "Access restricted")).toBe(false);
  });

  it("a user with neither permission is access-restricted", async () => {
    session.getCurrentPermissions.mockResolvedValue(["notifications.read"]);
    const tree = await ReportsPage({ searchParams: searchParams() });
    expect(hasTitle(tree, "Access restricted")).toBe(true);
  });

  it("an unauthenticated visitor is access-restricted", async () => {
    session.getCurrentProfile.mockResolvedValue(null);
    session.getCurrentPermissions.mockResolvedValue([]);
    const tree = await ReportsPage({ searchParams: searchParams() });
    expect(hasTitle(tree, "Access restricted")).toBe(true);
  });
});
