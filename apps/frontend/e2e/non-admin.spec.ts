import { test, expect } from "@playwright/test";
import { loginAsUserViaApi } from "./helpers";

test.describe("Non-admin access (permission-gated features)", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsUserViaApi(page);
    await page.goto("/dashboard");
  });

  test("hides permission-gated nav links", async ({ page }) => {
    await expect(page.getByRole("link", { name: /^dashboard$|^tableau de bord$/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /^users$|^utilisateurs$/i })).not.toBeVisible();
    await expect(page.getByRole("link", { name: /^roles$|^rôles$/i })).not.toBeVisible();
    await expect(page.getByRole("link", { name: /audit log|journal d'audit/i })).not.toBeVisible();
    await expect(page.getByRole("link", { name: /^settings$|^paramètres$/i })).not.toBeVisible();
  });

  test("is redirected away from /settings", async ({ page }) => {
    await page.goto("/settings");
    await page.waitForURL("**/expenses", { timeout: 10_000 });
    await expect(page).toHaveURL(/\/expenses/);
  });

  test("gets 403 from permission-gated APIs", async ({ page }) => {
    const [users, roles, settings, audit] = await Promise.all([
      page.request.get("/api/users"),
      page.request.get("/api/roles"),
      page.request.get("/api/settings"),
      page.request.get("/api/audit"),
    ]);
    expect(users.status()).toBe(403);
    expect(roles.status()).toBe(403);
    expect(settings.status()).toBe(403);
    expect(audit.status()).toBe(403);
  });

  test("can still export their own expenses without the EXPORT permission", async ({ page }) => {
    const res = await page.request.get("/api/expenses/export");
    expect(res.status()).toBe(200);
  });
});
