import { describe, it, expect } from "vitest";

import { toCsv } from "@/lib/reports/csv";

describe("toCsv", () => {
  it("returns empty string for no rows", () => {
    expect(toCsv([])).toBe("");
  });

  it("emits a header row and data rows", () => {
    const csv = toCsv([
      { a: "1", b: 2 },
      { a: "3", b: 4 },
    ]);
    expect(csv).toBe("a,b\n1,2\n3,4");
  });

  it("quotes values containing commas, quotes, or newlines", () => {
    const csv = toCsv([{ name: 'A, "B"', note: "line1\nline2" }]);
    expect(csv).toBe('name,note\n"A, ""B""","line1\nline2"');
  });

  it("renders null as empty", () => {
    expect(toCsv([{ a: null, b: "x" }])).toBe("a,b\n,x");
  });
});
