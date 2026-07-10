import { test, expect } from "@playwright/test";
import { loginViaApi } from "./helpers";

test.describe("Expenses page", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaApi(page);
    await page.goto("/expenses");
  });

  test("renders the expenses heading", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /^expenses$|^dépenses$/i })).toBeVisible();
  });

  test("shows the search input", async ({ page }) => {
    await expect(page.getByPlaceholder(/search|recherche/i)).toBeVisible();
  });

  test("shows the export button", async ({ page }) => {
    await expect(page.getByRole("button", { name: /^export$|^exporter$/i })).toBeVisible();
  });

  test("shows empty state when there are no expenses", async ({ page }) => {
    await expect(page.getByText(/no expenses found|aucune dépense/i)).toBeVisible();
  });

  test("shows the expense table headers", async ({ page }) => {
    // Headers include a sort indicator ("▼"/"▲") when active, so use partial match
    await expect(page.getByRole("columnheader", { name: /date/i })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: /vendor|fournisseur/i })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: /category|catégorie/i })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: /status|statut/i })).toBeVisible();
  });

  test("shows a status filter dropdown", async ({ page }) => {
    // The status filter is a <select> with the "All statuses" default option
    await expect(page.getByText(/all statuses|tous les statuts/i)).toBeVisible();
  });
});
