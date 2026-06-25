PRAGMA foreign_keys=OFF;

-- Redefine User to add role/active/createdAt. SQLite forbids ADD COLUMN with a
-- non-constant default (CURRENT_TIMESTAMP) on a non-empty table, so we rebuild.
-- The earliest pre-existing account (by original rowid) is promoted to admin.
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'user',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO "new_User" ("id","email","passwordHash","role","active","createdAt")
SELECT "id","email","passwordHash",
  CASE WHEN "rowid" = (SELECT MIN("rowid") FROM "User") THEN 'admin' ELSE 'user' END,
  true,
  CURRENT_TIMESTAMP
FROM "User"
ORDER BY "rowid" ASC;

DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- Redefine Expense to add the required userId relation: SQLite requires a table
-- rebuild to add a NOT NULL column with no constant default on a non-empty table.
CREATE TABLE "new_Expense" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "fournisseur" TEXT,
    "categorie" TEXT NOT NULL DEFAULT 'Autre',
    "description" TEXT,
    "devise" TEXT NOT NULL DEFAULT 'EUR',
    "montant_ttc" REAL,
    "montant_ht" REAL,
    "tva" REAL,
    "montant_ttc_eur" REAL,
    "montant_ht_eur" REAL,
    "taux_change" REAL,
    "taux_change_date" TEXT,
    "pays" TEXT,
    "langue_detectee" TEXT,
    "fichier" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "Expense_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "new_Expense" ("id","date","fournisseur","categorie","description","devise","montant_ttc","montant_ht","tva","montant_ttc_eur","montant_ht_eur","taux_change","taux_change_date","pays","langue_detectee","fichier","createdAt","updatedAt","userId")
SELECT "id","date","fournisseur","categorie","description","devise","montant_ttc","montant_ht","tva","montant_ttc_eur","montant_ht_eur","taux_change","taux_change_date","pays","langue_detectee","fichier","createdAt","updatedAt",
  (SELECT "id" FROM "User" ORDER BY "rowid" ASC LIMIT 1)
FROM "Expense";

DROP TABLE "Expense";
ALTER TABLE "new_Expense" RENAME TO "Expense";

PRAGMA foreign_keys=ON;

-- CreateTable
CREATE TABLE "ExpenseReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "periodFrom" TEXT,
    "periodTo" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    CONSTRAINT "ExpenseReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExpenseReportItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reportId" TEXT NOT NULL,
    "expenseId" TEXT NOT NULL,
    CONSTRAINT "ExpenseReportItem_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "ExpenseReport" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ExpenseReportItem_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseReportItem_reportId_expenseId_key" ON "ExpenseReportItem"("reportId", "expenseId");
