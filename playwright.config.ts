import { defineConfig, devices } from "@playwright/test";

/**
 * E2E config. Point at STAGING (or a local stack) — NEVER production.
 *   PLAYWRIGHT_BASE_URL  e.g. https://bc-planner-git-...staging.vercel.app or http://localhost:3000
 *   E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD     (admin/section_head user)
 *   E2E_EMPLOYEE_EMAIL / E2E_EMPLOYEE_PASSWORD
 * Auth-dependent specs skip automatically when these are unset.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
