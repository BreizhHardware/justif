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
    await expect(page.getByText(/by category|par catégorie/i)).toBeVisible();
    await expect(page.getByText(/monthly trend|évolution mensuelle/i)).toBeVisible();
  });

  test("shows no data when there are no expenses", async ({ page }) => {
    // With an empty E2E database, both charts show "No data"
    await expect(page.getByText(/no data|aucune donnée/i).first()).toBeVisible();
  });
});
