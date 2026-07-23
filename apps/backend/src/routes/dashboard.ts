import { Router, type Request, type Response } from "express";
import { prisma } from "../lib/prisma.js";

const router = Router();

router.get("/summary", async (req: Request, res: Response) => {
  const user = req.user!;
  const { from, to, userId } = req.query as Record<string, string>;

  const targetUserId = user.permissions.includes("VIEW_DASHBOARD") && userId ? userId : user.id;

  const dateFilter: { gte?: Date; lte?: Date } = {};
  if (from) dateFilter.gte = new Date(from);
  if (to) dateFilter.lte = new Date(to);

  const where = {
    userId: targetUserId,
    ...(Object.keys(dateFilter).length > 0 && { date: dateFilter }),
  };

  const [totals, byCategory, recentReports, allExpenses] = await Promise.all([
    prisma.expense.aggregate({
      where,
      _sum: { montant_ttc_eur: true },
      _count: { id: true },
    }),

    prisma.expense.groupBy({
      by: ["categorie"],
      where,
      _sum: { montant_ttc_eur: true },
      _count: { id: true },
      orderBy: { _sum: { montant_ttc_eur: "desc" } },
    }),

    prisma.expenseReport.findMany({
      where: { userId: targetUserId },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { _count: { select: { items: true } } },
    }),

    prisma.expense.findMany({
      where,
      select: { date: true, montant_ttc_eur: true },
    }),
  ]);

  // SQLite doesn't support DATE_TRUNC so we group by month in JS
  const monthMap = new Map<string, { count: number; sum: number }>();
  for (const e of allExpenses) {
    const key = e.date.toISOString().slice(0, 7); // "YYYY-MM"
    const existing = monthMap.get(key) ?? { count: 0, sum: 0 };
    monthMap.set(key, {
      count: existing.count + 1,
      sum: existing.sum + (e.montant_ttc_eur ?? 0),
    });
  }

  const byMonth = Array.from(monthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, { count, sum }]) => ({
      month,
      count,
      sum: Math.round(sum * 100) / 100,
    }));

  const total = totals._sum.montant_ttc_eur ?? 0;
  const count = totals._count.id ?? 0;

  res.json({
    total: Math.round(total * 100) / 100,
    count,
    average: count > 0 ? Math.round((total / count) * 100) / 100 : 0,
    byCategory: byCategory.map((c) => ({
      categorie: c.categorie,
      sum: Math.round((c._sum.montant_ttc_eur ?? 0) * 100) / 100,
      count: c._count.id,
    })),
    byMonth,
    recentReports: recentReports.map((r) => ({
      id: r.id,
      name: r.name,
      createdAt: r.createdAt,
      count: r._count.items,
    })),
  });
});

export default router;
