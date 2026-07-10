import { defineConfig, devices } from "@playwright/test";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Absolute path to the dedicated E2E SQLite database (never the dev DB)
const E2E_DB_PATH = path.resolve(__dirname, "../backend/db/justif-e2e.db");
const E2E_DATABASE_URL = `file:${E2E_DB_PATH}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  reporter: "list",

  // Runs once before servers start: applies migrations + seeds test admin
  globalSetup: "./e2e/global-setup.ts",

  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:3001",
    trace: "on-first-retry",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  webServer: [
    {
      // Express backend starts with the E2E database so tests never touch
      // the dev database. Port 3000 must be free when running `pnpm test`.
      command: "pnpm --filter backend run dev",
      port: 3000,
      env: { DATABASE_URL: E2E_DATABASE_URL },
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      // Vinext frontend — port is pinned to 3001 in vite.config.ts.
      command: "pnpm --filter frontend run dev",
      port: 3001,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
});
