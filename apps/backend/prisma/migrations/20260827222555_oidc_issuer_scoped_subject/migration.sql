-- The OIDC "sub" claim is only guaranteed unique within a given issuer, so
-- the account lookup key is now (oidcIssuer, oidcSubject) instead of
-- oidcSubject alone.

-- AlterTable
ALTER TABLE "User" ADD COLUMN "oidcIssuer" TEXT;

-- DropIndex
DROP INDEX "User_oidcSubject_key";

-- CreateIndex
CREATE UNIQUE INDEX "User_oidcIssuer_oidcSubject_key" ON "User"("oidcIssuer", "oidcSubject");
