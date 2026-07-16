import bcrypt from "bcrypt";
import type { Expense } from "@prisma/client";
import { prisma } from "../src/lib/prisma.js";
import { PERMISSIONS, SEED_ROLE_NAMES } from "../src/lib/permissions.js";

export const DEFAULT_PASSWORD = "password123";

export async function seedSystemRoles() {
  const admin = await prisma.role.create({
    data: {
      name: SEED_ROLE_NAMES.ADMIN,
      description: "Full access",
      permissions: { createMany: { data: PERMISSIONS.map((permission) => ({ permission })) } },
    },
  });
  const user = await prisma.role.create({
    data: { name: SEED_ROLE_NAMES.USER, description: "No elevated permissions" },
  });
  return { admin, user };
}

export async function getRoleIdByName(name: string): Promise<string> {
  const role = await prisma.role.findUniqueOrThrow({ where: { name } });
  return role.id;
}

export async function createUser(opts: {
  email: string;
  password?: string;
  roleNames?: string[];
  active?: boolean;
}) {
  const passwordHash = await bcrypt.hash(opts.password ?? DEFAULT_PASSWORD, 4);
  const roleNames = opts.roleNames ?? [SEED_ROLE_NAMES.USER];
  const roles = await prisma.role.findMany({ where: { name: { in: roleNames } } });
  const user = await prisma.user.create({
    data: {
      email: opts.email,
      passwordHash,
      active: opts.active ?? true,
      roles: { createMany: { data: roles.map((role) => ({ roleId: role.id })) } },
    },
  });
  return user;
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
