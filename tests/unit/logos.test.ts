import { describe, it, expect } from "vitest";

import { resolveLineLogo, lineLogoSrc } from "@/lib/dashboard/logos";

// Deterministic slug-exact resolution — no onError chain, no cross-mapping. The
// file base name must equal the business-line slug; a misnamed file (e.g.
// "TSS-logo.png" → base "tss-logo") does NOT resolve the "tss" slug.
const sample = {
  merapp: "/business-lines/merapp.jpg",
  artc: "/business-lines/artc.png",
  "driving-school": "/business-lines/driving-school.png",
  "tss-logo": "/business-lines/TSS-logo.png", // misnamed: base ≠ "tss"
};

describe("resolveLineLogo", () => {
  it("resolves a slug-exact file", () => {
    expect(resolveLineLogo(sample, "merapp")).toBe("/business-lines/merapp.jpg");
    expect(resolveLineLogo(sample, "driving-school")).toBe(
      "/business-lines/driving-school.png",
    );
  });

  it("is case-insensitive on the slug", () => {
    expect(resolveLineLogo(sample, "ARTC")).toBe("/business-lines/artc.png");
  });

  it("returns null for a misnamed file (no cross-mapping to a similar base)", () => {
    // "tss" must NOT pick up "tss-logo".
    expect(resolveLineLogo(sample, "tss")).toBeNull();
  });

  it("returns null for an unknown slug", () => {
    expect(resolveLineLogo(sample, "nope")).toBeNull();
  });
});

describe("lineLogoSrc (live manifest)", () => {
  it("returns null for a slug that has no file (stable across asset changes)", () => {
    expect(lineLogoSrc("definitely-not-a-business-line")).toBeNull();
  });
});
