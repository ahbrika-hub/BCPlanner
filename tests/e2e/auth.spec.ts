import { test, expect, type Page } from "@playwright/test";

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign In" }).click();
  await page.waitForURL("**/dashboard");
}

const admin = {
  email: process.env.E2E_ADMIN_EMAIL,
  password: process.env.E2E_ADMIN_PASSWORD,
};
const employee = {
  email: process.env.E2E_EMPLOYEE_EMAIL,
  password: process.env.E2E_EMPLOYEE_PASSWORD,
};

test.describe("public", () => {
  test("login page renders the branded form", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByText("TSS Planner")).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign In" })).toBeVisible();
  });

  test("unauthenticated /dashboard redirects to /login", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForURL("**/login");
    await expect(page.getByRole("button", { name: "Sign In" })).toBeVisible();
  });
});

test.describe("authenticated (requires E2E creds)", () => {
  test.skip(!admin.email || !admin.password, "E2E_ADMIN_* not set");

  test("admin logs in and sees the dashboard nav", async ({ page }) => {
    await login(page, admin.email!, admin.password!);
    await expect(page.getByRole("link", { name: "Tasks" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Dashboard" })).toBeVisible();
  });

  test("admin can open the New Task dialog", async ({ page }) => {
    await login(page, admin.email!, admin.password!);
    await page.goto("/tasks");
    await page.getByRole("button", { name: "New Task" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
  });
});

test.describe("permission gating (requires employee creds)", () => {
  test.skip(!employee.email || !employee.password, "E2E_EMPLOYEE_* not set");

  test("employee is blocked from approvals + audit", async ({ page }) => {
    await login(page, employee.email!, employee.password!);
    await page.goto("/approvals");
    await expect(page.getByText("Access restricted")).toBeVisible();
    await page.goto("/admin/audit");
    await expect(page.getByText("Access restricted")).toBeVisible();
  });
});
