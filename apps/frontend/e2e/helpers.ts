import type { Page } from "@playwright/test";
import { E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD } from "./constants";

/**
 * Logs in via API request (not UI), storing the auth cookie in the
 * browser context. Faster and more reliable for tests that are not
 * testing the login flow itself.
 */
export async function loginViaApi(page: Page): Promise<void> {
  const response = await page.request.post("/api/auth/login", {
    data: { email: E2E_ADMIN_EMAIL, password: E2E_ADMIN_PASSWORD },
  });
  if (!response.ok()) {
    throw new Error(
      `E2E login failed (${response.status()}): is the E2E backend running with the seeded database?`,
    );
  }
}
