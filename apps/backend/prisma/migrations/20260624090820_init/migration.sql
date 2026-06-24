-- CreateTable
CREATE TABLE "Expense" (
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
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Setting_key_key" ON "Setting"("key");
