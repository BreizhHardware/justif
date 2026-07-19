import { Router, type Request, type Response } from "express";
import { prisma } from "../lib/prisma.js";

const router = Router();

router.get("/summary", async (req: Request, res: Response) => {
  const user = req.user!;
  const { from, to, userId, granularity: rawGranularity } = req.query as Record<string, string>;

  const targetUserId = user.permissions.includes("VIEW_DASHBOARD") && userId ? userId : user.id;
  const granularity = rawGranularity === "day" ? "day" : "month";

  const dateFilter: { gte?: Date; lte?: Date } = {};
  if (from) dateFilter.gte = new Date(from);
  if (to) dateFilter.lte = new Date(to);

  const where = {
    userId: targetUserId,
    ...(Object.keys(dateFilter).length > 0 && { date: dateFilter }),
  };

  const [totals, byCategory, byVendorRaw, recentReports, allExpenses] = await Promise.all([
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

    prisma.expense.groupBy({
      by: ["fournisseur"],
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

  // SQLite doesn't support DATE_TRUNC so we group by month/day in JS
  const periodMap = new Map<string, { count: number; sum: number }>();
  for (const e of allExpenses) {
    const key =
      granularity === "day" ? e.date.toISOString().slice(0, 10) : e.date.toISOString().slice(0, 7);
    const existing = periodMap.get(key) ?? { count: 0, sum: 0 };
    periodMap.set(key, {
      count: existing.count + 1,
      sum: existing.sum + (e.montant_ttc_eur ?? 0),
    });
  }

  const byMonth = Array.from(periodMap.entries())
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
    byVendor: byVendorRaw.map((v) => ({
      fournisseur: v.fournisseur,
      sum: Math.round((v._sum.montant_ttc_eur ?? 0) * 100) / 100,
      count: v._count.id,
    })),
    byMonth,
    granularity,
    recentReports: recentReports.map((r) => ({
      id: r.id,
      name: r.name,
      createdAt: r.createdAt,
      count: r._count.items,
    })),
  });
});

export default router;
