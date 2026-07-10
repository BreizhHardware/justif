import { Router, type Request, type Response } from "express";
import multer from "multer";
import sharp from "sharp";
import path from "node:path";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import { randomUUID } from "node:crypto";
import { ZipArchive } from "@archiver/archiver";
import { prisma } from "../lib/prisma.js";
import { convertExpenseAmounts } from "../services/currencyService.js";
import {
  buildExpensesWorkbook,
  ensureConvertedAmounts,
  exportFileName,
  getAttachmentFilename,
} from "../services/exportService.js";
import { getDefaultCurrency } from "./settings.js";
import { audit, ipFromReq } from "../services/auditService.js";

const router = Router();
const UPLOAD_DIR = process.env.UPLOAD_DIR ?? "./uploads";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

function cuid(): string {
  return randomUUID().replace(/-/g, "");
}

async function saveUploadedFile(file: Express.Multer.File, date: Date): Promise<string> {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const subdir = `${yyyy}-${mm}`;
  const dir = path.join(UPLOAD_DIR, subdir);
  await fs.mkdir(dir, { recursive: true });

  const isImage = file.mimetype.startsWith("image/");
  const ext = isImage ? "jpg" : path.extname(file.originalname) || ".pdf";
  const filename = `${cuid()}${isImage ? "." + ext : ext}`;
  const fullPath = path.join(dir, filename);

  if (isImage) {
    const resized = await sharp(file.buffer)
      .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 90 })
      .toBuffer();
    await fs.writeFile(fullPath, resized);
  } else {
    await fs.writeFile(fullPath, file.buffer);
  }

  return path.posix.join(subdir, filename);
}

function parseExpenseBody(body: Record<string, string>) {
  return {
    date: body.date ? new Date(body.date) : undefined,
    fournisseur: body.fournisseur ?? undefined,
    numero_reference: body.numero_reference ?? undefined,
    categorie: body.categorie ?? undefined,
    description: body.description ?? undefined,
    devise: body.devise ?? undefined,
    montant_ttc: body.montant_ttc !== undefined ? Number(body.montant_ttc) : undefined,
    montant_ht: body.montant_ht !== undefined ? Number(body.montant_ht) : undefined,
    tva: body.tva !== undefined ? Number(body.tva) : undefined,
    pays: body.pays ?? undefined,
    langue_detectee: body.langue_detectee ?? undefined,
  };
}

// Resolves whose expenses to display: the caller themselves, or,
// for an admin, another user via ?userId= (global view by tab).
async function resolveTargetUserId(req: Request, res: Response): Promise<string | null> {
  const requestedUserId = req.query.userId as string | undefined;
  if (!requestedUserId || requestedUserId === req.user!.id) {
    return req.user!.id;
  }
  if (req.user!.role !== "admin") {
    res.status(403).json({ error: "Access denied to another user's expenses" });
    return null;
  }
  const target = await prisma.user.findUnique({ where: { id: requestedUserId } });
  if (!target) {
    res.status(404).json({ error: "User not found" });
    return null;
  }
  return target.id;
}

function canEdit(req: Request, expenseUserId: string): boolean {
  return expenseUserId === req.user!.id || req.user!.role === "admin";
}

function buildWhere(query: Record<string, string | undefined>, userId: string) {
  const { from, to, categorie, devise, q } = query;
  const where: Record<string, unknown> = { userId };
  if (from || to) {
    where.date = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    };
  }
  if (categorie) where.categorie = categorie;
  if (devise) where.devise = devise;
  if (q) {
    where.OR = [
      { fournisseur: { contains: q } },
      { numero_reference: { contains: q } },
      { description: { contains: q } },
    ];
  }
  return where;
}

function formatFr(isoDate: string): string {
  const [y, m, d] = isoDate.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

function reportName(from?: string, to?: string): string {
  if (from && to) return `Note de frais ${formatFr(from)} – ${formatFr(to)}`;
  if (from) return `Note de frais depuis le ${formatFr(from)}`;
  if (to) return `Note de frais jusqu'au ${formatFr(to)}`;
  return `Note de frais ${formatFr(new Date().toISOString())}`;
}

router.get("/", async (req, res) => {
  const targetUserId = await resolveTargetUserId(req, res);
  if (!targetUserId) return;

  const {
    page = "1",
    limit = "20",
    from,
    to,
    categorie,
    devise,
    q,
    sort = "date",
    order = "desc",
  } = req.query as Record<string, string>;

  const where = buildWhere({ from, to, categorie, devise, q }, targetUserId);

  const pageNum = Math.max(1, Number(page));
  const limitNum = Math.max(1, Number(limit));
  const allowedSort = [
    "date",
    "fournisseur",
    "numero_reference",
    "categorie",
    "montant_ttc",
    "devise",
    "montant_ttc_eur",
  ];
  const orderBy = {
    [allowedSort.includes(sort) ? sort : "date"]: order === "asc" ? "asc" : "desc",
  };

  const [data, total] = await Promise.all([
    prisma.expense.findMany({
      where,
      orderBy,
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
    }),
    prisma.expense.count({ where }),
  ]);

  res.json({ data, total, page: pageNum, pages: Math.ceil(total / limitNum) });
});

router.post("/", upload.single("fichier"), async (req, res) => {
  try {
    const parsed = parseExpenseBody(req.body);
    if (!parsed.date) {
      res.status(400).json({ error: "Date required" });
      return;
    }

    const defaultCurrency = await getDefaultCurrency();
    const devise = parsed.devise ?? defaultCurrency;

    let fichier: string | undefined;
    if (req.file) {
      fichier = await saveUploadedFile(req.file, parsed.date);
    }

    const conversion = await convertExpenseAmounts({
      devise,
      date: parsed.date,
      montant_ttc: parsed.montant_ttc ?? null,
      montant_ht: parsed.montant_ht ?? null,
      defaultCurrency,
    });

    const expense = await prisma.expense.create({
      data: {
        date: parsed.date,
        fournisseur: parsed.fournisseur,
        numero_reference: parsed.numero_reference,
        categorie: parsed.categorie ?? "Autre",
        description: parsed.description,
        devise,
        montant_ttc: parsed.montant_ttc,
        montant_ht: parsed.montant_ht,
        tva: parsed.tva,
        pays: parsed.pays,
        langue_detectee: parsed.langue_detectee,
        fichier,
        userId: req.user!.id,
        ...conversion,
      },
    });
    await audit({
      userId: req.user!.id,
      action: "expense.create",
      entityType: "Expense",
      entityId: expense.id,
      metadata: { categorie: expense.categorie, devise: expense.devise },
      ip: ipFromReq(req),
    });
    res.status(201).json(expense);
  } catch (err) {
    console.error("[expenses] Creation error:", err);
    res.status(500).json({ error: "Error creating expense" });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const existing = await prisma.expense.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: "Expense not found" });
      return;
    }
    if (!canEdit(req, existing.userId)) {
      res.status(403).json({ error: "Access denied" });
      return;
    }

    const parsed = parseExpenseBody(req.body);
    const defaultCurrency = await getDefaultCurrency();

    const nextDate = parsed.date ?? existing.date;
    const nextDevise = parsed.devise ?? existing.devise;
    const nextTtc = parsed.montant_ttc ?? existing.montant_ttc;
    const nextHt = parsed.montant_ht ?? existing.montant_ht;

    const dateChanged =
      parsed.date !== undefined && parsed.date.getTime() !== existing.date.getTime();
    const deviseChanged = parsed.devise !== undefined && parsed.devise !== existing.devise;
    const amountsChanged = parsed.montant_ttc !== undefined || parsed.montant_ht !== undefined;

    let conversion = {
      montant_ttc_eur: existing.montant_ttc_eur,
      montant_ht_eur: existing.montant_ht_eur,
      taux_change: existing.taux_change,
      taux_change_date: existing.taux_change_date,
    };
    if (dateChanged || deviseChanged || amountsChanged) {
      conversion = await convertExpenseAmounts({
        devise: nextDevise,
        date: nextDate,
        montant_ttc: nextTtc,
        montant_ht: nextHt,
        defaultCurrency,
      });
    }

    const expense = await prisma.expense.update({
      where: { id: req.params.id },
      data: {
        ...parsed,
        ...conversion,
      },
    });
    await audit({
      userId: req.user!.id,
      action: "expense.update",
      entityType: "Expense",
      entityId: expense.id,
      targetUserId: existing.userId !== req.user!.id ? existing.userId : null,
      metadata: { fields: Object.keys(req.body as Record<string, unknown>) },
      ip: ipFromReq(req),
    });
    res.json(expense);
  } catch (err) {
    console.error("[expenses] Update error:", err);
    res.status(500).json({ error: "Error updating expense" });
  }
});

router.post("/:id/recalculate", async (req, res) => {
  const existing = await prisma.expense.findUnique({ where: { id: req.params.id } });
  if (!existing) {
    res.status(404).json({ error: "Expense not found" });
    return;
  }
  if (!canEdit(req, existing.userId)) {
    res.status(403).json({ error: "Access denied" });
    return;
  }
  const defaultCurrency = await getDefaultCurrency();
  const conversion = await convertExpenseAmounts({
    devise: existing.devise,
    date: existing.date,
    montant_ttc: existing.montant_ttc,
    montant_ht: existing.montant_ht,
    defaultCurrency,
  });
  const expense = await prisma.expense.update({ where: { id: req.params.id }, data: conversion });
  await audit({
    userId: req.user!.id,
    action: "expense.recalculate",
    entityType: "Expense",
    entityId: existing.id,
    targetUserId: existing.userId !== req.user!.id ? existing.userId : null,
    ip: ipFromReq(req),
  });
  res.json(expense);
});

router.delete("/:id", async (req, res) => {
  const existing = await prisma.expense.findUnique({ where: { id: req.params.id } });
  if (!existing) {
    res.status(404).json({ error: "Expense not found" });
    return;
  }
  if (!canEdit(req, existing.userId)) {
    res.status(403).json({ error: "Access denied" });
    return;
  }
  // The original receipt file is never deleted from disk, even when the expense is deleted.
  await prisma.expense.delete({ where: { id: req.params.id } });
  await audit({
    userId: req.user!.id,
    action: "expense.delete",
    entityType: "Expense",
    entityId: existing.id,
    targetUserId: existing.userId !== req.user!.id ? existing.userId : null,
    // Snapshot key fields: entity no longer exists after deletion.
    metadata: {
      date: existing.date.toISOString().slice(0, 10),
      fournisseur: existing.fournisseur,
      montant_ttc: existing.montant_ttc,
      devise: existing.devise,
      categorie: existing.categorie,
    },
    ip: ipFromReq(req),
  });
  res.status(204).end();
});

// Before generating an export, returns which expenses in the current filter have already
// been included in a previous report, so the user can choose to re-include them or not.
router.get("/export-overlap", async (req, res) => {
  const targetUserId = await resolveTargetUserId(req, res);
  if (!targetUserId) return;

  const { from, to, categorie, devise, q } = req.query as Record<string, string>;
  const where = buildWhere({ from, to, categorie, devise, q }, targetUserId);

  const expenses = await prisma.expense.findMany({
    where,
    select: {
      id: true,
      reportedIn: { select: { report: { select: { id: true, name: true, createdAt: true } } } },
    },
  });

  const reportMap = new Map<string, { id: string; name: string; createdAt: Date; count: number }>();
  let freshCount = 0;
  for (const expense of expenses) {
    if (expense.reportedIn.length === 0) {
      freshCount += 1;
      continue;
    }
    for (const item of expense.reportedIn) {
      const entry = reportMap.get(item.report.id) ?? { ...item.report, count: 0 };
      entry.count += 1;
      reportMap.set(item.report.id, entry);
    }
  }

  res.json({
    total: expenses.length,
    freshCount,
    previousReports: Array.from(reportMap.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    ),
  });
});

router.get("/export", async (req, res) => {
  const targetUserId = await resolveTargetUserId(req, res);
  if (!targetUserId) return;

  const { from, to, categorie, devise, q, includeReportIds, format } = req.query as Record<
    string,
    string
  >;
  const where = buildWhere({ from, to, categorie, devise, q }, targetUserId);
  const includeSet = new Set((includeReportIds ?? "").split(",").filter(Boolean));

  const matching = await prisma.expense.findMany({
    where,
    orderBy: { date: "asc" },
    include: { reportedIn: true },
  });

  const finalExpenses = matching.filter(
    (expense) =>
      expense.reportedIn.length === 0 ||
      expense.reportedIn.some((item) => includeSet.has(item.reportId)),
  );

  const defaultCurrency = await getDefaultCurrency();
  const converted = await ensureConvertedAmounts(finalExpenses, defaultCurrency);

  const registerReport = async () => {
    if (finalExpenses.length === 0) return null;
    return prisma.expenseReport.create({
      data: {
        name: reportName(from, to),
        periodFrom: from ?? null,
        periodTo: to ?? null,
        userId: targetUserId,
        items: { create: finalExpenses.map((expense) => ({ expenseId: expense.id })) },
      },
    });
  };

  if (format === "zip") {
    const attachmentMap = new Map<string, string>();
    for (const expense of converted) {
      const filename = getAttachmentFilename(expense);
      if (filename) attachmentMap.set(expense.id, filename);
    }

    const workbook = await buildExpensesWorkbook(converted, defaultCurrency, attachmentMap);
    const xlsxFilename = exportFileName(from);
    const zipFilename = xlsxFilename.replace(".xlsx", ".zip");

    const report = await registerReport();
    await audit({
      userId: req.user!.id,
      action: "export.zip",
      entityType: "ExpenseReport",
      entityId: report?.id,
      targetUserId: targetUserId !== req.user!.id ? targetUserId : null,
      metadata: { count: finalExpenses.length, periodFrom: from ?? null, periodTo: to ?? null },
      ip: ipFromReq(req),
    });

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${zipFilename}"`);

    const archive = new ZipArchive({ zlib: { level: 6 } });
    archive.pipe(res);

    const excelBuffer = Buffer.from(await workbook.xlsx.writeBuffer());
    archive.append(excelBuffer, { name: xlsxFilename });

    for (const expense of converted) {
      const attachmentFilename = attachmentMap.get(expense.id);
      if (attachmentFilename && expense.fichier) {
        const filePath = path.resolve(UPLOAD_DIR, expense.fichier);
        if (fsSync.existsSync(filePath)) {
          archive.file(filePath, { name: `attachments/${attachmentFilename}` });
        }
      }
    }

    await archive.finalize();
    return;
  }

  const workbook = await buildExpensesWorkbook(converted, defaultCurrency);
  const filename = exportFileName(from);

  const report = await registerReport();
  await audit({
    userId: req.user!.id,
    action: "export.xlsx",
    entityType: "ExpenseReport",
    entityId: report?.id,
    targetUserId: targetUserId !== req.user!.id ? targetUserId : null,
    metadata: { count: finalExpenses.length, periodFrom: from ?? null, periodTo: to ?? null },
    ip: ipFromReq(req),
  });

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  await workbook.xlsx.write(res);
  res.end();
});

export default router;
