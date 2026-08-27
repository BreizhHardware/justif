-- CreateTable
CREATE TABLE "RoleOidcGroup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roleId" TEXT NOT NULL,
    "groupName" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RoleOidcGroup_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "oidcSubject" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "theme" TEXT NOT NULL DEFAULT 'system',
    "dashboardBreakdownBy" TEXT NOT NULL DEFAULT 'category',
    "dashboardGranularity" TEXT NOT NULL DEFAULT 'month',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_User" ("active", "createdAt", "dashboardBreakdownBy", "dashboardGranularity", "email", "id", "passwordHash", "theme") SELECT "active", "createdAt", "dashboardBreakdownBy", "dashboardGranularity", "email", "id", "passwordHash", "theme" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_oidcSubject_key" ON "User"("oidcSubject");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "RoleOidcGroup_groupName_key" ON "RoleOidcGroup"("groupName");
