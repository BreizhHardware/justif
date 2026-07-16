import { afterAll, beforeEach } from "vitest";
import { prisma } from "../src/lib/prisma.js";
import { seedSystemRoles } from "./fixtures.js";

beforeEach(async () => {
  await prisma.expenseReportItem.deleteMany();
  await prisma.expenseReport.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.setting.deleteMany();
  await prisma.userRole.deleteMany();
  await prisma.user.deleteMany();
  await prisma.rolePermission.deleteMany();
  await prisma.role.deleteMany();
  await seedSystemRoles();
});

afterAll(async () => {
  await prisma.$disconnect();
});
