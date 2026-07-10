-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "targetUserId" TEXT,
    "metadata" TEXT,
    "ip" TEXT,
    "userId" TEXT,
    CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
