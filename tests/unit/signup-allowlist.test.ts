import { describe, it, expect } from "vitest";

import {
  isAllowedSignupEmail,
  signupSchema,
  ALLOWED_SIGNUP_ENTRIES,
} from "@/lib/validations/auth";

// The allow-list accepts the corporate DOMAIN saptco.com.sa and two FULL-EMAIL
// exceptions (specific gmails) — never the whole gmail.com domain.
describe("isAllowedSignupEmail", () => {
  it("accepts any @saptco.com.sa address (domain match)", () => {
    expect(isAllowedSignupEmail("anyone@saptco.com.sa")).toBe(true);
    expect(isAllowedSignupEmail("First.Last@SAPTCO.COM.SA")).toBe(true);
  });

  it("accepts the two specific gmail exceptions (full-email match)", () => {
    expect(isAllowedSignupEmail("tss.bc2026@gmail.com")).toBe(true);
    expect(isAllowedSignupEmail("ahbrika@gmail.com")).toBe(true);
    expect(isAllowedSignupEmail("AHBRIKA@gmail.com")).toBe(true);
  });

  it("rejects any other gmail (the domain is NOT opened)", () => {
    expect(isAllowedSignupEmail("someone.else@gmail.com")).toBe(false);
    expect(isAllowedSignupEmail("tss.bc2027@gmail.com")).toBe(false);
  });

  it("rejects the old domain and unrelated domains", () => {
    expect(isAllowedSignupEmail("user@saptco.com")).toBe(false); // no .sa
    expect(isAllowedSignupEmail("user@hotmail.com")).toBe(false);
    expect(isAllowedSignupEmail("user@tss.test")).toBe(false); // removed
  });

  it("the entries are exactly the three intended", () => {
    expect([...ALLOWED_SIGNUP_ENTRIES]).toEqual([
      "saptco.com.sa",
      "tss.bc2026@gmail.com",
      "ahbrika@gmail.com",
    ]);
  });
});

describe("signupSchema email refinement", () => {
  const base = { full_name: "Test User", password: "password1", confirm: "password1" };
  it("passes an allowed email", () => {
    expect(signupSchema.safeParse({ ...base, email: "x@saptco.com.sa" }).success).toBe(true);
    expect(signupSchema.safeParse({ ...base, email: "ahbrika@gmail.com" }).success).toBe(true);
  });
  it("rejects a disallowed email", () => {
    expect(signupSchema.safeParse({ ...base, email: "x@gmail.com" }).success).toBe(false);
  });
});
