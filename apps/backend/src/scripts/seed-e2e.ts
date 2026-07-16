/**
 * Seeds the database with deterministic E2E test accounts: an admin and a
 * plain non-admin user, for testing permission-gated behavior.
 * Run via: DATABASE_URL=<url> pnpm --filter backend run seed:e2e
 *
 * Credentials (also defined in apps/frontend/e2e/constants.ts):
 *   admin: admin@e2e.test / e2e-password-123
 *   user:  user@e2e.test  / e2e-password-123
 */
import bcrypt from "bcrypt";
import { prisma } from "../lib/prisma.js";
import { SEED_ROLE_NAMES } from "../lib/permissions.js";

const E2E_ADMIN_EMAIL = "admin@e2e.test";
const E2E_ADMIN_PASSWORD = "e2e-password-123";
const E2E_USER_EMAIL = "user@e2e.test";
const E2E_USER_PASSWORD = "e2e-password-123";

async function upsertE2eUser(email: string, password: string, roleName: string) {
  const role = await prisma.role.findUniqueOrThrow({ where: { name: roleName } });
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, active: true },
    create: { email, passwordHash, active: true },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: user.id, roleId: role.id } },
    update: {},
    create: { userId: user.id, roleId: role.id },
  });
}

await upsertE2eUser(E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD, SEED_ROLE_NAMES.ADMIN);
await upsertE2eUser(E2E_USER_EMAIL, E2E_USER_PASSWORD, SEED_ROLE_NAMES.USER);

await prisma.$disconnect();

console.log("[seed-e2e] Test accounts ready:", E2E_ADMIN_EMAIL, E2E_USER_EMAIL);
