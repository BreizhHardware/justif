import { test, expect } from "@playwright/test";

test.describe("Privacy policy page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/privacy");
  });

  test("renders the privacy policy heading", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: /privacy policy|politique de confidentialité/i }),
    ).toBeVisible();
  });

  test("contains the IP address collection section", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /ip address|adresse ip/i })).toBeVisible();
  });

  test("contains the GDPR rights section", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /your rights|vos droits/i })).toBeVisible();
  });

  test("has a working back-to-login link", async ({ page }) => {
    await page.getByRole("link", { name: /back to sign in|retour à la connexion/i }).click();
    await page.waitForURL("**/login");
    expect(page.url()).toContain("/login");
  });
});
