import { test, expect } from "@playwright/test";
import { loginViaApi } from "./helpers";

test.describe("Dashboard page", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaApi(page);
    await page.goto("/dashboard");
  });

  test("renders the dashboard heading", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: /^dashboard$|^tableau de bord$/i }),
    ).toBeVisible();
  });

  test("shows stat cards", async ({ page }) => {
    await expect(page.getByText(/total incl\. tax|total ttc/i)).toBeVisible();
    await expect(page.getByText(/number of expenses|nombre de dépenses/i)).toBeVisible();
    await expect(page.getByText(/average per expense|moyenne par dépense/i)).toBeVisible();
  });

  test("shows date filter inputs", async ({ page }) => {
    // The dashboard has From/To date filters
    const inputs = page.locator('input[type="date"]');
    await expect(inputs.first()).toBeVisible();
  });

  test("shows chart section headings", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: /^by category$|par catégorie/i }),
    ).toBeVisible();
    await expect(page.getByText(/monthly trend|évolution mensuelle/i)).toBeVisible();
  });

  test("shows no data when there are no expenses", async ({ page }) => {
    // With an empty E2E database, both charts show "No data"
    await expect(page.getByText(/no data|aucune donnée/i).first()).toBeVisible();
  });

  test("toggles the breakdown chart between category and vendor", async ({ page }) => {
    // The seeded admin account is reused across many e2e spec files, so avoid
    // letting this test's preference toggle persist to the real backend.
    await page.route("**/api/auth/me", (route) => {
      if (route.request().method() === "PATCH") {
        return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
      }
      return route.fallback();
    });

    await expect(
      page.getByRole("heading", { name: /^by category$|par catégorie/i }),
    ).toBeVisible();

    await page.getByRole("button", { name: /by vendor|par fournisseur/i }).click();

    await expect(
      page.getByRole("heading", { name: /^by vendor$|par fournisseur/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /^by category$|par catégorie/i }),
    ).not.toBeVisible();
  });

  test("toggles the trend chart between month and day", async ({ page }) => {
    await page.route("**/api/auth/me", (route) => {
      if (route.request().method() === "PATCH") {
        return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
      }
      return route.fallback();
    });

    await expect(
      page.getByRole("heading", { name: /monthly trend|évolution mensuelle/i }),
    ).toBeVisible();

    await page.getByRole("button", { name: /^day$|^jour$/i }).click();

    await expect(
      page.getByRole("heading", { name: /daily trend|évolution journalière/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /monthly trend|évolution mensuelle/i }),
    ).not.toBeVisible();
  });
});
