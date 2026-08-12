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

  test("sends a password reset email and shows a confirmation", async ({ page }) => {
    await page.route("**/api/users/*/send-reset-email", (route) => route.fulfill({ status: 204 }));

    await page
      .getByRole("button", { name: /send password reset email|envoyer un email de/i })
      .first()
      .click();

    await expect(page.getByText(/reset email sent|email de réinitialisation envoyé/i)).toBeVisible({
      timeout: 10_000,
    });
  });

  test("shows an error when the reset email fails to send", async ({ page }) => {
    await page.route("**/api/users/*/send-reset-email", (route) =>
      route.fulfill({
        status: 502,
        contentType: "application/json",
        body: JSON.stringify({ error: "Failed to send the email - check the SMTP settings" }),
      }),
    );

    await page
      .getByRole("button", { name: /send password reset email|envoyer un email de/i })
      .first()
      .click();

    await expect(
      page.getByText(/failed to send the reset email|échec de l'envoi de l'email/i),
    ).toBeVisible({ timeout: 10_000 });
  });
});

test.describe("Audit log page (admin)", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaApi(page);
    await page.goto("/audit");
  });

  test("renders the audit log heading", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /audit log|journal d'audit/i })).toBeVisible();
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
    await expect(page.getByRole("heading", { name: /^settings$|^paramètres$/i })).toBeVisible();
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

  test("shows the validation workflow toggle", async ({ page }) => {
    // Text appears in both a heading and its label; use .first() to avoid a strict-mode violation.
    await expect(
      page.getByText(/validation workflow|circuit de validation/i).first(),
    ).toBeVisible();
  });

  test("shows the SMTP configuration section", async ({ page }) => {
    await expect(page.getByText(/email \(smtp\)/i)).toBeVisible();
    await expect(page.getByLabel(/smtp host|serveur smtp/i)).toBeVisible();
    await expect(
      page.getByRole("button", { name: /send test email|envoyer un email de test/i }),
    ).toBeVisible();
  });
});

test.describe("Forgot / reset password pages", () => {
  test("links from the login page to /forgot-password", async ({ page }) => {
    await page.goto("/login", { waitUntil: "networkidle" });
    await page.getByRole("link", { name: /forgot your password|mot de passe oublié/i }).click();
    await page.waitForURL("**/forgot-password");
    await expect(page).toHaveURL(/\/forgot-password/);
  });

  test("shows a generic success message for any email, without revealing account existence", async ({
    page,
  }) => {
    await page.goto("/forgot-password", { waitUntil: "networkidle" });
    await page.getByLabel(/email/i).fill("definitely-not-a-real-account@example.com");
    await page.getByRole("button", { name: /send reset link|envoyer le lien/i }).click();

    await expect(
      page.getByText(/reset link has been sent|lien de réinitialisation a été envoyé/i),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("shows a missing-token message when visited without a token", async ({ page }) => {
    await page.goto("/reset-password", { waitUntil: "networkidle" });
    await expect(page.getByText(/missing its token|n'a pas de jeton valide/i)).toBeVisible();
  });

  test("shows an invalid-token error for a bogus token", async ({ page }) => {
    await page.goto("/reset-password?token=not-a-real-token", { waitUntil: "networkidle" });
    await page.getByLabel(/^new password$|^nouveau mot de passe$/i).fill("brand-new-password");
    await page
      .getByLabel(/confirm new password|confirmer le nouveau mot de passe/i)
      .fill("brand-new-password");
    await page
      .getByRole("button", { name: /reset password|réinitialiser le mot de passe/i })
      .click();

    await expect(page.getByText(/invalid or has expired|invalide ou a expiré/i)).toBeVisible({
      timeout: 10_000,
    });
  });
});
