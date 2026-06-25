import { afterAll, beforeEach } from "vitest";
import { prisma } from "../src/lib/prisma.js";

beforeEach(async () => {
  await prisma.expenseReportItem.deleteMany();
  await prisma.expenseReport.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.setting.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});
