import { Router } from "express";
import { prisma } from "../lib/prisma.js";

const router = Router();

router.get("/", async (req, res) => {
  const { page = "1", limit = "50", action, userId, entityType, from, to } =
    req.query as Record<string, string>;

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));

  const where: Record<string, unknown> = {};
  if (action) where.action = action;
  if (userId) where.userId = userId;
  if (entityType) where.entityType = entityType;
  if (from || to) {
    where.timestamp = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    };
  }

  const [total, logs] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { timestamp: "desc" },
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
      include: { user: { select: { email: true } } },
    }),
  ]);

  res.json({ data: logs, total, page: pageNum, pages: Math.ceil(total / limitNum) });
});

export default router;
