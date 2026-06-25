import bcrypt from "bcrypt";
import type { Expense } from "@prisma/client";
import { prisma } from "../src/lib/prisma.js";

export const DEFAULT_PASSWORD = "password123";

export async function createUser(opts: {
  email: string;
  password?: string;
  role?: "admin" | "user";
  active?: boolean;
}) {
  const passwordHash = await bcrypt.hash(opts.password ?? DEFAULT_PASSWORD, 4);
  return prisma.user.create({
    data: {
      email: opts.email,
      passwordHash,
      role: opts.role ?? "user",
      active: opts.active ?? true,
    },
  });
}

export function fakeExpense(overrides: Partial<Expense> = {}): Expense {
  const now = new Date("2026-01-15T00:00:00.000Z");
  return {
    id: "expense_1",
    date: now,
    fournisseur: "Fournisseur Test",
    categorie: "Autre",
    description: "Description test",
    devise: "EUR",
    montant_ttc: 100,
    montant_ht: 80,
    tva: 20,
    montant_ttc_eur: 100,
    montant_ht_eur: 80,
    taux_change: 1,
    taux_change_date: "2026-01-15",
    pays: "FR",
    langue_detectee: "fr",
    fichier: "facture.pdf",
    createdAt: now,
    updatedAt: now,
    userId: "user_1",
    ...overrides,
  };
}
