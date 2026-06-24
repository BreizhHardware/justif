import { Router } from "express";
import multer from "multer";
import sharp from "sharp";
import path from "node:path";
import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { prisma } from "../lib/prisma.js";
import { convertExpenseAmounts } from "../services/currencyService.js";
import {
  buildExpensesWorkbook,
  ensureConvertedAmounts,
  exportFileName,
} from "../services/exportService.js";
import { getDefaultCurrency } from "./settings.js";

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

router.get("/", async (req, res) => {
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

  const where: Record<string, unknown> = {};
  if (from || to) {
    where.date = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    };
  }
  if (categorie) where.categorie = categorie;
  if (devise) where.devise = devise;
  if (q) {
    where.OR = [{ fournisseur: { contains: q } }, { description: { contains: q } }];
  }

  const pageNum = Math.max(1, Number(page));
  const limitNum = Math.max(1, Number(limit));
  const allowedSort = [
    "date",
    "fournisseur",
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
      res.status(400).json({ error: "Date requise" });
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
        categorie: parsed.categorie ?? "Autre",
        description: parsed.description,
        devise,
        montant_ttc: parsed.montant_ttc,
        montant_ht: parsed.montant_ht,
        tva: parsed.tva,
        pays: parsed.pays,
        langue_detectee: parsed.langue_detectee,
        fichier,
        ...conversion,
      },
    });

    res.status(201).json(expense);
  } catch (err) {
    console.error("[expenses] Erreur création:", err);
    res.status(500).json({ error: "Erreur lors de la création de la dépense" });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const existing = await prisma.expense.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: "Dépense introuvable" });
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

    res.json(expense);
  } catch (err) {
    console.error("[expenses] Erreur mise à jour:", err);
    res.status(500).json({ error: "Erreur lors de la mise à jour de la dépense" });
  }
});

router.post("/:id/recalculate", async (req, res) => {
  const existing = await prisma.expense.findUnique({ where: { id: req.params.id } });
  if (!existing) {
    res.status(404).json({ error: "Dépense introuvable" });
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
  res.json(expense);
});

router.delete("/:id", async (req, res) => {
  const existing = await prisma.expense.findUnique({ where: { id: req.params.id } });
  if (!existing) {
    res.status(404).json({ error: "Dépense introuvable" });
    return;
  }
  // Le fichier justificatif original n'est jamais supprimé du disque, même si la dépense l'est
  await prisma.expense.delete({ where: { id: req.params.id } });
  res.status(204).end();
});

router.get("/export", async (req, res) => {
  const { from, to, categorie, devise, q } = req.query as Record<string, string>;

  const where: Record<string, unknown> = {};
  if (from || to) {
    where.date = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    };
  }
  if (categorie) where.categorie = categorie;
  if (devise) where.devise = devise;
  if (q) {
    where.OR = [{ fournisseur: { contains: q } }, { description: { contains: q } }];
  }

  const expenses = await prisma.expense.findMany({ where, orderBy: { date: "asc" } });
  const defaultCurrency = await getDefaultCurrency();
  const converted = await ensureConvertedAmounts(expenses, defaultCurrency);

  const workbook = await buildExpensesWorkbook(converted, defaultCurrency);
  const filename = exportFileName(from);

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  await workbook.xlsx.write(res);
  res.end();
});

export default router;
