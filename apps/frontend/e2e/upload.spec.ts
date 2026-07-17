import { test, expect } from "@playwright/test";
import { loginViaApi } from "./helpers";

test.describe("Upload page", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaApi(page);
    await page.goto("/upload");
  });

  test("renders the upload heading", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: /import a receipt|importer un justificatif/i }),
    ).toBeVisible();
  });

  test("shows the file dropzone", async ({ page }) => {
    await expect(page.getByText(/drop a file here|déposer un fichier/i)).toBeVisible();
  });

  test("dropzone has a hidden file input", async ({ page }) => {
    // The hidden input accepts images and PDFs
    const input = page.locator('input[type="file"]');
    await expect(input).toBeAttached();
    const accept = await input.getAttribute("accept");
    expect(accept).toMatch(/image|pdf/i);
  });
});
