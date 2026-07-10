import { test, expect } from "@playwright/test";
import { loginViaApi } from "./helpers";
import { E2E_ADMIN_EMAIL } from "./constants";

test.describe("Users page (admin)", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaApi(page);
    await page.goto("/users");
  });

  test("renders the users heading", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /^users$|^utilisateurs$/i })).toBeVisible();
  });

  test("shows the seeded admin user", async ({ page }) => {
    // The email appears in both the AppShell sidebar and the users table;
    // use .first() to avoid a strict-mode violation.
    await expect(page.getByText(E2E_ADMIN_EMAIL).first()).toBeVisible({ timeout: 15_000 });
  });

  test("shows the create user form", async ({ page }) => {
    await expect(page.getByLabel(/email/i).first()).toBeVisible();
    await expect(page.getByLabel(/password|mot de passe/i)).toBeVisible();
  });
});

test.describe("Audit log page (admin)", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaApi(page);
    await page.goto("/audit");
  });

  test("renders the audit log heading", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: /audit log|journal d'audit/i }),
    ).toBeVisible();
  });

  test("shows audit log entries from the E2E setup", async ({ page }) => {
    // loginViaApi creates an auth.login event; scope to tbody to avoid matching
    // the action filter <select> options. Use .first() because multiple runs
    // accumulate entries in the persistent E2E database.
    await expect(
      page.locator("tbody").getByText("auth.login", { exact: true }).first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("shows filter inputs", async ({ page }) => {
    // Audit filters use <span> labels (not <label>), and date <input> elements
    const dateInputs = page.locator('input[type="date"]');
    await expect(dateInputs.first()).toBeVisible();
    await expect(dateInputs.nth(1)).toBeVisible();
  });
});

test.describe("Settings page (admin)", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaApi(page);
    await page.goto("/settings");
  });

  test("renders the settings heading", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: /^settings$|^paramètres$/i }),
    ).toBeVisible();
  });

  test("shows the OCR provider selector", async ({ page }) => {
    await expect(page.getByText(/ocr provider|fournisseur ocr/i)).toBeVisible();
  });

  test("shows the default currency selector", async ({ page }) => {
    await expect(page.getByText(/default currency|devise par défaut/i)).toBeVisible();
  });

  test("shows the save button", async ({ page }) => {
    await expect(page.getByRole("button", { name: /^save$|^enregistrer$/i })).toBeVisible();
  });
});
