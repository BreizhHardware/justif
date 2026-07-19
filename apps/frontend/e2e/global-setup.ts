/**
 * Playwright global setup - runs once before any test or webServer.
 *
 * 1. Ensures apps/backend/db/ exists.
 * 2. Applies Prisma migrations to a dedicated E2E SQLite database so the
 *    production dev database is never touched by automated tests.
 * 3. Upserts the fixed test admin account used across all E2E specs.
 */
import { execSync } from "child_process";
import { mkdirSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Absolute path so it works regardless of CWD
const E2E_DB_PATH = path.resolve(__dirname, "../../backend/db/justif-e2e.db");
export const E2E_DATABASE_URL = `file:${E2E_DB_PATH}`;

export default async function globalSetup() {
  // Ensure the db directory exists (it usually does in dev, but not in CI)
  mkdirSync(path.dirname(E2E_DB_PATH), { recursive: true });

  const env = { ...process.env, DATABASE_URL: E2E_DATABASE_URL };
  const opts = { env, stdio: "inherit" as const };

  // Apply existing migrations (does not create new migration files)
  console.log("[e2e] Applying migrations to", E2E_DB_PATH);
  execSync("pnpm --filter backend run db:deploy", opts);

  // Upsert the fixed test admin account
  console.log("[e2e] Seeding test admin account");
  execSync("pnpm --filter backend run seed:e2e", opts);
}
