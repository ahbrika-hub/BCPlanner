import { describe, it, expect } from "vitest";

import {
  paginateEntries,
  compareEntriesDesc,
  type TimelineEntry,
  type TimelineCursor,
} from "@/lib/data/timeline";

// Proves the merge/sort/paginate is correctly ordered (newest-first, total order
// by (timestamp, id)) and that walking the pages reconstructs the full stream
// with no gaps or overlaps — including a same-timestamp tie across sources.

function e(
  id: string,
  ts: string,
  type: TimelineEntry["type"] = "comment",
): TimelineEntry {
  return { id, type, actor: "A", timestamp: ts, summary: "x", detail: null };
}

const ALL: TimelineEntry[] = [
  e("a", "2026-06-10T10:00:00Z"),
  e("b", "2026-06-11T10:00:00Z"),
  e("c", "2026-06-12T10:00:00Z", "status"),
  e("d", "2026-06-12T10:00:00Z", "update"), // tie timestamp with c, id breaks it
  e("f", "2026-06-13T10:00:00Z", "attachment"),
];

// newest-first: ts desc, then id desc → f, d, c, b, a
const ORDER = ["f", "d", "c", "b", "a"];

describe("compareEntriesDesc", () => {
  it("orders newest-first, breaking timestamp ties by id desc", () => {
    const ids = [...ALL].sort(compareEntriesDesc).map((x) => x.id);
    expect(ids).toEqual(ORDER);
  });
});

describe("paginateEntries", () => {
  it("returns the first page and a cursor at its last item", () => {
    const page = paginateEntries(ALL, null, 2);
    expect(page.entries.map((x) => x.id)).toEqual(["f", "d"]);
    expect(page.nextCursor).toEqual({ ts: "2026-06-12T10:00:00Z", id: "d" });
  });

  it("respects a cursor on a tied timestamp (returns the lower id next)", () => {
    const cursor: TimelineCursor = { ts: "2026-06-12T10:00:00Z", id: "d" };
    const page = paginateEntries(ALL, cursor, 2);
    // 'c' shares d's timestamp but a smaller id, so it comes after d.
    expect(page.entries.map((x) => x.id)).toEqual(["c", "b"]);
  });

  it("walks every page with no gaps or overlaps", () => {
    const seen: string[] = [];
    let cursor: TimelineCursor | null = null;
    // page size 2 over 5 items → 3 pages
    for (let i = 0; i < 10; i++) {
      const page = paginateEntries(ALL, cursor, 2);
      seen.push(...page.entries.map((x) => x.id));
      if (!page.nextCursor) break;
      cursor = page.nextCursor;
    }
    expect(seen).toEqual(ORDER); // exact reconstruction, no dups, no gaps
  });

  it("clears the cursor when the last page exactly fills the page size", () => {
    const four = ALL.slice(0, 4); // a,b,c,d
    const p1 = paginateEntries(four, null, 2);
    expect(p1.nextCursor).not.toBeNull();
    const p2 = paginateEntries(four, p1.nextCursor, 2);
    expect(p2.entries).toHaveLength(2);
    expect(p2.nextCursor).toBeNull(); // nothing left, even though page was full
  });

  it("handles an empty history", () => {
    expect(paginateEntries([], null, 20)).toEqual({
      entries: [],
      nextCursor: null,
    });
  });
});
