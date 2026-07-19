import { test, expect } from "@playwright/test";
import { E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD } from "./constants";

test.describe("Login page", () => {
  test.beforeEach(async ({ page }) => {
    // waitUntil: "networkidle" ensures React has finished hydrating and attached
    // event handlers before any test interacts with the form.
    await page.goto("/login", { waitUntil: "networkidle" });
  });

  test("renders the sign-in form with all expected elements", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /sign in|connexion/i })).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password|mot de passe/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /sign in|se connecter/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /privacy|confidentialité/i })).toBeVisible();
  });

  test("shows an error on invalid credentials", async ({ page }) => {
    // Mock the login endpoint so the test is not sensitive to API routing quirks
    await page.route("**/api/auth/login", (route) =>
      route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ error: "Invalid credentials" }),
      }),
    );

    await page.getByLabel(/email/i).fill("nobody@example.com");
    await page.getByLabel(/password|mot de passe/i).fill("wrongpassword");
    await page.getByRole("button", { name: /sign in|se connecter/i }).click();

    await expect(page.getByText(/invalid credentials|identifiants invalides/i)).toBeVisible({
      timeout: 10_000,
    });
  });

  test("redirects to /dashboard after successful login", async ({ page }) => {
    // Mock login to return a valid-looking session
    await page.route("**/api/auth/login", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ token: "e2e-test-token" }),
      }),
    );
    // Mock the APIs that the dashboard page calls on mount so it doesn't bounce back to /login
    await page.route("**/api/auth/me", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          email: E2E_ADMIN_EMAIL,
          roles: ["Admin"],
          permissions: [
            "EXPORT",
            "CONFIG_OCR",
            "VIEW_DASHBOARD",
            "MANAGE_USERS",
            "MANAGE_SETTINGS",
            "VIEW_AUDIT_LOG",
          ],
          dashboardGranularity: "month",
          dashboardBreakdownBy: "category",
        }),
      }),
    );
    await page.route("**/api/dashboard/**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          total: 0,
          count: 0,
          average: 0,
          byCategory: [],
          byVendor: [],
          byMonth: [],
          granularity: "month",
          recentReports: [],
        }),
      }),
    );

    await page.getByLabel(/email/i).fill(E2E_ADMIN_EMAIL);
    await page.getByLabel(/password|mot de passe/i).fill(E2E_ADMIN_PASSWORD);
    await page.getByRole("button", { name: /sign in|se connecter/i }).click();

    await page.waitForURL("**/dashboard", { timeout: 10_000 });
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("links to the privacy policy page", async ({ page }) => {
    await page.getByRole("link", { name: /privacy|confidentialité/i }).click();
    await page.waitForURL("**/privacy");
    await expect(page).toHaveURL(/\/privacy/);
  });
});
