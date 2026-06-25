import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeExpense } from "../fixtures.js";

vi.mock("../../src/services/currencyService.js", () => ({
  getRateCached: vi.fn(),
}));

import { getRateCached } from "../../src/services/currencyService.js";
import {
  buildExpensesWorkbook,
  ensureConvertedAmounts,
  exportFileName,
} from "../../src/services/exportService.js";

const getRateCachedMock = vi.mocked(getRateCached);

beforeEach(() => {
  getRateCachedMock.mockReset();
});

describe("exportFileName", () => {
  it("builds a filename from the given reference date", () => {
    expect(exportFileName("2026-03-15")).toBe("justif_2026-03.xlsx");
  });

  it("falls back to the current date when none is given", () => {
    const now = new Date();
    const expected = `justif_${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}.xlsx`;
    expect(exportFileName()).toBe(expected);
  });
});

describe("ensureConvertedAmounts", () => {
  it("leaves an expense untouched when it already has a converted amount", async () => {
    const expense = fakeExpense({ montant_ttc_eur: 100 });

    const result = await ensureConvertedAmounts([expense], "EUR");

    expect(result).toEqual([expense]);
    expect(getRateCachedMock).not.toHaveBeenCalled();
  });

  it("leaves an expense untouched when there is no original amount to convert", async () => {
    const expense = fakeExpense({ montant_ttc: null, montant_ttc_eur: null });

    const result = await ensureConvertedAmounts([expense], "EUR");

    expect(result).toEqual([expense]);
    expect(getRateCachedMock).not.toHaveBeenCalled();
  });

  it("retries the conversion and fills in the converted amounts on success", async () => {
    const expense = fakeExpense({
      devise: "USD",
      montant_ttc: 200,
      montant_ht: 150,
      montant_ttc_eur: null,
      montant_ht_eur: null,
      taux_change: null,
      taux_change_date: null,
    });
    getRateCachedMock.mockResolvedValue({ rate: 0.5, date: "2026-01-15" });

    const [result] = await ensureConvertedAmounts([expense], "EUR");

    expect(result).toMatchObject({
      montant_ttc_eur: 100,
      montant_ht_eur: 75,
      taux_change: 0.5,
      taux_change_date: "2026-01-15",
    });
  });

  it("returns the original expense unchanged when the retry fails", async () => {
    const expense = fakeExpense({
      devise: "USD",
      montant_ttc: 200,
      montant_ttc_eur: null,
    });
    getRateCachedMock.mockRejectedValue(new Error("Frankfurter error: 500"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const [result] = await ensureConvertedAmounts([expense], "EUR");

    expect(result).toEqual(expense);
  });
});

describe("buildExpensesWorkbook", () => {
  it("builds a Dépenses sheet with header, data rows and a TOTAL row", async () => {
    const expenses = [
      fakeExpense({ id: "e1", montant_ttc: 100, montant_ht_eur: 80, montant_ttc_eur: 100 }),
      fakeExpense({ id: "e2", montant_ttc_eur: null, montant_ht_eur: null }),
    ];

    const workbook = await buildExpensesWorkbook(expenses, "EUR");
    const sheet = workbook.getWorksheet("Dépenses")!;

    expect(sheet.getRow(1).getCell(1).value).toBe("Date");
    expect(sheet.getRow(2).getCell(9).value).toBe(80);
    expect(sheet.getRow(2).getCell(10).value).toBe(100);
    expect(sheet.getRow(3).getCell(9).value).toBe("N/D");
    expect(sheet.getRow(3).getCell(10).value).toBe("N/D");

    const totalRow = sheet.getRow(4);
    expect(totalRow.getCell(1).value).toBe("TOTAL");
    expect(totalRow.getCell(9).value).toBe(80);
    expect(totalRow.getCell(10).value).toBe(100);
  });

  it("builds a Résumé sheet grouping by catégorie and by devise", async () => {
    const expenses = [
      fakeExpense({
        id: "e1",
        categorie: "Repas",
        devise: "EUR",
        montant_ttc: 50,
        montant_ttc_eur: 50,
        taux_change: 1,
      }),
      fakeExpense({
        id: "e2",
        categorie: "Repas",
        devise: "EUR",
        montant_ttc: 30,
        montant_ttc_eur: 30,
        taux_change: 1,
      }),
      fakeExpense({
        id: "e3",
        categorie: "Transport",
        devise: "USD",
        montant_ttc: 20,
        montant_ttc_eur: 18,
        taux_change: 0.9,
      }),
    ];

    const workbook = await buildExpensesWorkbook(expenses, "EUR");
    const sheet = workbook.getWorksheet("Résumé")!;

    const rowValues = (rowNumber: number, lastColumn: number) =>
      Array.from({ length: lastColumn }, (_, i) => sheet.getRow(rowNumber).getCell(i + 1).value);

    expect(rowValues(1, 3)).toEqual(["Catégorie", "Nb dépenses", "Total TTC (EUR)"]);
    expect(rowValues(2, 3)).toEqual(["Repas", 2, 80]);
    expect(rowValues(3, 3)).toEqual(["Transport", 1, 18]);

    const deviseHeaderRow = sheet.getRow(6);
    expect(deviseHeaderRow.getCell(1).value).toBe("Devise");
    expect(rowValues(7, 5)).toEqual(["EUR", 2, 80, 1, 80]);
    expect(rowValues(8, 5)).toEqual(["USD", 1, 20, 0.9, 18]);
  });
});
