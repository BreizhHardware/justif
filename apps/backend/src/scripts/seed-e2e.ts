/**
 * Seeds the database with a deterministic E2E test admin account.
 * Run via: DATABASE_URL=<url> pnpm --filter backend run seed:e2e
 *
 * Credentials (also defined in apps/frontend/e2e/constants.ts):
 *   email:    admin@e2e.test
 *   password: e2e-password-123
 */
import bcrypt from "bcrypt";
import { prisma } from "../lib/prisma.js";

const E2E_ADMIN_EMAIL = "admin@e2e.test";
const E2E_ADMIN_PASSWORD = "e2e-password-123";

const passwordHash = await bcrypt.hash(E2E_ADMIN_PASSWORD, 10);

await prisma.user.upsert({
  where: { email: E2E_ADMIN_EMAIL },
  update: { passwordHash, role: "admin", active: true },
  create: { email: E2E_ADMIN_EMAIL, passwordHash, role: "admin", active: true },
});

await prisma.$disconnect();

console.log("[seed-e2e] Test admin ready:", E2E_ADMIN_EMAIL);
