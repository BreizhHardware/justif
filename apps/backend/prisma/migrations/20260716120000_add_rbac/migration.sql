-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roleId" TEXT NOT NULL,
    "permission" TEXT NOT NULL,
    CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserRole" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Seed the two system roles (literal IDs — SQLite has no server-side cuid();
-- these are fixed seed rows, not app-generated data).
INSERT INTO "Role" ("id","name","description","createdAt") VALUES
  ('rbac_role_admin', 'Admin', 'Full access (seeded; replaces legacy role="admin")', CURRENT_TIMESTAMP),
  ('rbac_role_user',  'User',  'No elevated permissions (seeded; replaces legacy role="user")', CURRENT_TIMESTAMP);

-- Admin gets all 6 permissions. "User" gets none: a user can always export
-- their own expenses unconditionally (see requirePermission("EXPORT") usage,
-- which only gates cross-user export), so a zero-permission default role is
-- not a regression versus the legacy role="user" behavior.
INSERT INTO "RolePermission" ("id","roleId","permission") VALUES
  ('rbac_perm_admin_export',          'rbac_role_admin', 'EXPORT'),
  ('rbac_perm_admin_config_ocr',      'rbac_role_admin', 'CONFIG_OCR'),
  ('rbac_perm_admin_view_dashboard',  'rbac_role_admin', 'VIEW_DASHBOARD'),
  ('rbac_perm_admin_manage_users',    'rbac_role_admin', 'MANAGE_USERS'),
  ('rbac_perm_admin_manage_settings', 'rbac_role_admin', 'MANAGE_SETTINGS'),
  ('rbac_perm_admin_view_audit_log',  'rbac_role_admin', 'VIEW_AUDIT_LOG');

-- Backfill: every existing user gets one UserRole row matching their legacy
-- role string. Must run before "User"."role" is dropped below.
INSERT INTO "UserRole" ("id","userId","roleId")
SELECT
  lower(hex(randomblob(16))),
  "id",
  CASE WHEN "role" = 'admin' THEN 'rbac_role_admin' ELSE 'rbac_role_user' END
FROM "User";

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_User" ("active", "createdAt", "email", "id", "passwordHash") SELECT "active", "createdAt", "email", "id", "passwordHash" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE UNIQUE INDEX "RolePermission_roleId_permission_key" ON "RolePermission"("roleId", "permission");

-- CreateIndex
CREATE UNIQUE INDEX "UserRole_userId_roleId_key" ON "UserRole"("userId", "roleId");
