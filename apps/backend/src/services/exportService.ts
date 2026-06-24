import ExcelJS from "exceljs";
import type { Expense } from "@prisma/client";
import { getRateCached } from "./currencyService.js";

const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF2D6A4F" },
};
const HEADER_FONT: Partial<ExcelJS.Font> = { color: { argb: "FFFFFFFF" }, bold: true };
const ALT_ROW_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFF0F4F2" },
};
const TOTAL_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFD8EFD3" },
};
const TOTAL_FONT: Partial<ExcelJS.Font> = { color: { argb: "FF1A3D2B" }, bold: true };
const NA_FONT: Partial<ExcelJS.Font> = { color: { argb: "FFCC0000" } };
const GREY_ITALIC_FONT: Partial<ExcelJS.Font> = { italic: true, color: { argb: "FF888888" } };

const CURRENCY_NUMFMT: Record<string, string> = {
  USD: '#,##0.00 "$"',
  GBP: '#,##0.00 "£"',
  CHF: '#,##0.00 "CHF"',
  JPY: '#,##0 "¥"',
  EUR: "#,##0.00 €",
};

function currencyFormat(code: string): string {
  return CURRENCY_NUMFMT[code] ?? `#,##0.00 "${code}"`;
}

function styleHeaderRow(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = { vertical: "middle", horizontal: "center" };
  });
}

function autoFitColumns(sheet: ExcelJS.Worksheet) {
  sheet.columns.forEach((col) => {
    let max = 10;
    col.eachCell?.({ includeEmpty: true }, (cell) => {
      const len = cell.value ? String(cell.value).length : 0;
      if (len > max) max = len;
    });
    col.width = max + 2;
  });
}

export async function ensureConvertedAmounts(
  expenses: Expense[],
  defaultCurrency: string,
): Promise<Expense[]> {
  return Promise.all(
    expenses.map(async (e) => {
      if (e.montant_ttc_eur !== null || e.montant_ttc === null) return e;
      try {
        const dateStr = e.date.toISOString().slice(0, 10);
        const { rate, date } = await getRateCached(e.devise, defaultCurrency, dateStr);
        return {
          ...e,
          montant_ttc_eur: e.montant_ttc !== null ? e.montant_ttc * rate : null,
          montant_ht_eur: e.montant_ht !== null ? e.montant_ht * rate : null,
          taux_change: rate,
          taux_change_date: date,
        };
      } catch (err) {
        console.error("[exportService] Reconversion échouée:", err);
        return e;
      }
    }),
  );
}

export async function buildExpensesWorkbook(
  expenses: Expense[],
  defaultCurrency: string,
): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  buildExpensesSheet(workbook, expenses, defaultCurrency);
  buildSummarySheet(workbook, expenses, defaultCurrency);
  return workbook;
}

function buildExpensesSheet(
  workbook: ExcelJS.Workbook,
  expenses: Expense[],
  defaultCurrency: string,
) {
  const sheet = workbook.addWorksheet("Dépenses");

  const headerRow = sheet.addRow([
    "Date",
    "Fournisseur",
    "Catégorie",
    "Description",
    "Montant original",
    "Devise",
    `Taux de change (${defaultCurrency})`,
    "Date du taux BCE",
    `Montant HT (${defaultCurrency})`,
    `Montant TTC (${defaultCurrency})`,
  ]);
  styleHeaderRow(headerRow);

  let totalHt = 0;
  let totalTtc = 0;

  expenses.forEach((expense, index) => {
    const row = sheet.addRow([
      expense.date,
      expense.fournisseur ?? "",
      expense.categorie,
      expense.description ?? "",
      expense.montant_ttc,
      expense.devise,
      expense.taux_change,
      expense.taux_change_date ? new Date(expense.taux_change_date) : null,
      expense.montant_ht_eur,
      expense.montant_ttc_eur,
    ]);

    if (index % 2 === 1) {
      row.eachCell((cell) => {
        cell.fill = ALT_ROW_FILL;
      });
    }

    const dateCell = row.getCell(1);
    dateCell.numFmt = "DD/MM/YYYY";

    const montantOriginalCell = row.getCell(5);
    montantOriginalCell.numFmt = currencyFormat(expense.devise);

    const tauxCell = row.getCell(7);
    tauxCell.numFmt = "0.0000";

    const tauxDateCell = row.getCell(8);
    tauxDateCell.numFmt = "DD/MM/YYYY";
    const depenseDateStr = expense.date.toISOString().slice(0, 10);
    if (expense.taux_change_date && expense.taux_change_date !== depenseDateStr) {
      tauxDateCell.font = GREY_ITALIC_FONT;
    }

    const htCell = row.getCell(9);
    const ttcCell = row.getCell(10);
    if (expense.montant_ht_eur === null) {
      htCell.value = "N/D";
      htCell.font = NA_FONT;
    } else {
      htCell.numFmt = currencyFormat(defaultCurrency);
      totalHt += expense.montant_ht_eur;
    }
    if (expense.montant_ttc_eur === null) {
      ttcCell.value = "N/D";
      ttcCell.font = NA_FONT;
    } else {
      ttcCell.numFmt = currencyFormat(defaultCurrency);
      totalTtc += expense.montant_ttc_eur;
    }
  });

  const totalRow = sheet.addRow(["TOTAL", "", "", "", "", "", "", "", totalHt, totalTtc]);
  totalRow.eachCell((cell) => {
    cell.fill = TOTAL_FILL;
    cell.font = TOTAL_FONT;
  });
  totalRow.getCell(9).numFmt = currencyFormat(defaultCurrency);
  totalRow.getCell(10).numFmt = currencyFormat(defaultCurrency);

  autoFitColumns(sheet);
}

function buildSummarySheet(
  workbook: ExcelJS.Workbook,
  expenses: Expense[],
  defaultCurrency: string,
) {
  const sheet = workbook.addWorksheet("Résumé");

  const byCategorie = new Map<string, { count: number; total: number }>();
  for (const e of expenses) {
    const entry = byCategorie.get(e.categorie) ?? { count: 0, total: 0 };
    entry.count += 1;
    entry.total += e.montant_ttc_eur ?? 0;
    byCategorie.set(e.categorie, entry);
  }

  const headerA = sheet.addRow(["Catégorie", "Nb dépenses", `Total TTC (${defaultCurrency})`]);
  styleHeaderRow(headerA);
  let rowIndex = 0;
  for (const [categorie, { count, total }] of byCategorie) {
    const row = sheet.addRow([categorie, count, total]);
    if (rowIndex % 2 === 1) row.eachCell((cell) => (cell.fill = ALT_ROW_FILL));
    row.getCell(3).numFmt = currencyFormat(defaultCurrency);
    rowIndex += 1;
  }

  sheet.addRow([]);
  sheet.addRow([]);

  const byDevise = new Map<
    string,
    { count: number; totalOriginal: number; totalEur: number; rates: number[] }
  >();
  for (const e of expenses) {
    const entry = byDevise.get(e.devise) ?? { count: 0, totalOriginal: 0, totalEur: 0, rates: [] };
    entry.count += 1;
    entry.totalOriginal += e.montant_ttc ?? 0;
    entry.totalEur += e.montant_ttc_eur ?? 0;
    if (e.taux_change !== null) entry.rates.push(e.taux_change);
    byDevise.set(e.devise, entry);
  }

  const headerB = sheet.addRow([
    "Devise",
    "Nb dépenses",
    "Total original",
    "Taux moyen",
    `Total (${defaultCurrency})`,
  ]);
  styleHeaderRow(headerB);
  rowIndex = 0;
  for (const [devise, { count, totalOriginal, totalEur, rates }] of byDevise) {
    const avgRate = rates.length > 0 ? rates.reduce((a, b) => a + b, 0) / rates.length : null;
    const row = sheet.addRow([devise, count, totalOriginal, avgRate, totalEur]);
    if (rowIndex % 2 === 1) row.eachCell((cell) => (cell.fill = ALT_ROW_FILL));
    row.getCell(3).numFmt = currencyFormat(devise);
    row.getCell(4).numFmt = "0.0000";
    row.getCell(5).numFmt = currencyFormat(defaultCurrency);
    rowIndex += 1;
  }

  autoFitColumns(sheet);
}

export function exportFileName(from?: string): string {
  const ref = from ? new Date(from) : new Date();
  const yyyy = ref.getFullYear();
  const mm = String(ref.getMonth() + 1).padStart(2, "0");
  return `justif_${yyyy}-${mm}.xlsx`;
}
