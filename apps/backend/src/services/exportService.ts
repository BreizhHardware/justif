import { Cell, Row, Workbook, Worksheet } from "documonster/excel";
import type { Fill, Font } from "documonster/excel";
import type { Expense } from "../generated/client.js";
import { getRateCached } from "./currencyService.js";

const HEADER_FILL: Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF2D6A4F" },
};
const HEADER_FONT: Partial<Font> = { color: { argb: "FFFFFFFF" }, bold: true };
const ALT_ROW_FILL: Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFF0F4F2" },
};
const TOTAL_FILL: Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFD8EFD3" },
};
const TOTAL_FONT: Partial<Font> = { color: { argb: "FF1A3D2B" }, bold: true };
const NA_FONT: Partial<Font> = { color: { argb: "FFCC0000" } };
const GREY_ITALIC_FONT: Partial<Font> = { italic: true, color: { argb: "FF888888" } };

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

function styleHeaderRow(sheet: Worksheet.Handle, rowNumber: number) {
  Row.setFill(sheet, rowNumber, HEADER_FILL);
  Row.setFont(sheet, rowNumber, HEADER_FONT);
  Row.setAlignment(sheet, rowNumber, { vertical: "middle", horizontal: "center" });
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
        console.error("[exportService] Reconversion failed:", err);
        return e;
      }
    }),
  );
}

export async function buildExpensesWorkbook(
  expenses: Expense[],
  defaultCurrency: string,
  attachmentMap?: Map<string, string>,
): Promise<Workbook.Handle> {
  const workbook = Workbook.create();
  buildExpensesSheet(workbook, expenses, defaultCurrency, attachmentMap);
  buildSummarySheet(workbook, expenses, defaultCurrency);
  return workbook;
}

export function getAttachmentFilename(expense: Expense): string | null {
  if (!expense.fichier) return null;
  const lastDot = expense.fichier.lastIndexOf(".");
  const ext = lastDot !== -1 ? expense.fichier.slice(lastDot) : "";
  return `${expense.id}${ext}`;
}

function buildExpensesSheet(
  workbook: Workbook.Handle,
  expenses: Expense[],
  defaultCurrency: string,
  attachmentMap?: Map<string, string>,
) {
  const sheet = Workbook.addWorksheet(workbook, "Expenses");

  const headerRow = Worksheet.addRow(sheet, [
    "Date",
    "Vendor",
    "Category",
    "Description",
    "Original amount",
    "Currency",
    `Exchange rate (${defaultCurrency})`,
    "ECB rate date",
    `Amount excl. tax (${defaultCurrency})`,
    `Amount incl. tax (${defaultCurrency})`,
    "Reference",
    ...(attachmentMap ? ["Attachment"] : []),
  ]);
  styleHeaderRow(sheet, headerRow.number);

  let totalHt = 0;
  let totalTtc = 0;

  expenses.forEach((expense, index) => {
    const row = Worksheet.addRow(sheet, [
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
      expense.numero_reference ?? "",
      ...(attachmentMap ? [attachmentMap.get(expense.id) ?? ""] : []),
    ]);

    if (index % 2 === 1) {
      Row.setFill(sheet, row.number, ALT_ROW_FILL);
    }

    Cell.setNumFmt(sheet, row.number, 1, "DD/MM/YYYY");
    Cell.setNumFmt(sheet, row.number, 5, currencyFormat(expense.devise));
    Cell.setNumFmt(sheet, row.number, 7, "0.0000");

    Cell.setNumFmt(sheet, row.number, 8, "DD/MM/YYYY");
    const depenseDateStr = expense.date.toISOString().slice(0, 10);
    if (expense.taux_change_date && expense.taux_change_date !== depenseDateStr) {
      Cell.setFont(sheet, row.number, 8, GREY_ITALIC_FONT);
    }

    if (expense.montant_ht_eur === null) {
      Cell.setValue(sheet, row.number, 9, "N/D");
      Cell.setFont(sheet, row.number, 9, NA_FONT);
    } else {
      Cell.setNumFmt(sheet, row.number, 9, currencyFormat(defaultCurrency));
      totalHt += expense.montant_ht_eur;
    }
    if (expense.montant_ttc_eur === null) {
      Cell.setValue(sheet, row.number, 10, "N/D");
      Cell.setFont(sheet, row.number, 10, NA_FONT);
    } else {
      Cell.setNumFmt(sheet, row.number, 10, currencyFormat(defaultCurrency));
      totalTtc += expense.montant_ttc_eur;
    }
  });

  const totalRow = Worksheet.addRow(sheet, [
    "TOTAL",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    totalHt,
    totalTtc,
    "",
  ]);
  Row.setFill(sheet, totalRow.number, TOTAL_FILL);
  Row.setFont(sheet, totalRow.number, TOTAL_FONT);
  Cell.setNumFmt(sheet, totalRow.number, 9, currencyFormat(defaultCurrency));
  Cell.setNumFmt(sheet, totalRow.number, 10, currencyFormat(defaultCurrency));

  Worksheet.autoFitColumns(sheet);
}

function buildSummarySheet(workbook: Workbook.Handle, expenses: Expense[], defaultCurrency: string) {
  const sheet = Workbook.addWorksheet(workbook, "Summary");

  const byCategorie = new Map<string, { count: number; total: number }>();
  for (const e of expenses) {
    const entry = byCategorie.get(e.categorie) ?? { count: 0, total: 0 };
    entry.count += 1;
    entry.total += e.montant_ttc_eur ?? 0;
    byCategorie.set(e.categorie, entry);
  }

  const headerA = Worksheet.addRow(sheet, [
    "Category",
    "# expenses",
    `Total incl. tax (${defaultCurrency})`,
  ]);
  styleHeaderRow(sheet, headerA.number);
  let rowIndex = 0;
  for (const [categorie, { count, total }] of byCategorie) {
    const row = Worksheet.addRow(sheet, [categorie, count, total]);
    if (rowIndex % 2 === 1) Row.setFill(sheet, row.number, ALT_ROW_FILL);
    Cell.setNumFmt(sheet, row.number, 3, currencyFormat(defaultCurrency));
    rowIndex += 1;
  }

  Worksheet.addRow(sheet, []);
  Worksheet.addRow(sheet, []);

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

  const headerB = Worksheet.addRow(sheet, [
    "Currency",
    "# expenses",
    "Original total",
    "Avg. rate",
    `Total (${defaultCurrency})`,
  ]);
  styleHeaderRow(sheet, headerB.number);
  rowIndex = 0;
  for (const [devise, { count, totalOriginal, totalEur, rates }] of byDevise) {
    const avgRate = rates.length > 0 ? rates.reduce((a, b) => a + b, 0) / rates.length : null;
    const row = Worksheet.addRow(sheet, [devise, count, totalOriginal, avgRate, totalEur]);
    if (rowIndex % 2 === 1) Row.setFill(sheet, row.number, ALT_ROW_FILL);
    Cell.setNumFmt(sheet, row.number, 3, currencyFormat(devise));
    Cell.setNumFmt(sheet, row.number, 4, "0.0000");
    Cell.setNumFmt(sheet, row.number, 5, currencyFormat(defaultCurrency));
    rowIndex += 1;
  }

  Worksheet.autoFitColumns(sheet);
}

export function exportFileName(from?: string): string {
  const ref = from ? new Date(from) : new Date();
  const yyyy = ref.getFullYear();
  const mm = String(ref.getMonth() + 1).padStart(2, "0");
  return `justif_${yyyy}-${mm}.xlsx`;
}
