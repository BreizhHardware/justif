import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  convertExpenseAmounts,
  getRateCached,
  listSupportedCurrencies,
} from "../../src/services/currencyService.js";

function jsonResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => body,
  } as Response;
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe("getRateCached", () => {
  it("returns rate 1 without calling fetch when from === to", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await getRateCached("EUR", "EUR", "2026-01-15");

    expect(result).toEqual({ rate: 1, date: "2026-01-15" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fetches and caches the rate for a given from/to/date triple", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ amount: 1, base: "USD", date: "2026-01-15", rates: { EUR: 0.9 } }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const first = await getRateCached("USD", "EUR", "2026-02-01");
    expect(first).toEqual({ rate: 0.9, date: "2026-01-15" });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const second = await getRateCached("USD", "EUR", "2026-02-01");
    expect(second).toEqual({ rate: 0.9, date: "2026-01-15" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("throws when the Frankfurter API responds with a non-ok status", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}, false, 500));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getRateCached("GBP", "EUR", "2026-03-03")).rejects.toThrow(
      "Frankfurter error: 500",
    );
  });

  it("throws when the target currency is missing from the response", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ amount: 1, base: "GBP", date: "2026-03-03", rates: {} }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getRateCached("GBP", "JPY", "2026-03-03")).rejects.toThrow(
      "Frankfurter: devise JPY non trouvée dans la réponse",
    );
  });
});

describe("listSupportedCurrencies", () => {
  it("returns the parsed currency map", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ EUR: "Euro", USD: "US Dollar" }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await listSupportedCurrencies();

    expect(result).toEqual({ EUR: "Euro", USD: "US Dollar" });
  });

  it("throws when the Frankfurter API responds with a non-ok status", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}, false, 503));
    vi.stubGlobal("fetch", fetchMock);

    await expect(listSupportedCurrencies()).rejects.toThrow("Frankfurter error: 503");
  });
});

describe("convertExpenseAmounts", () => {
  it("passes amounts through unchanged when the expense currency is the default one", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await convertExpenseAmounts({
      devise: "EUR",
      date: new Date("2026-04-10T00:00:00.000Z"),
      montant_ttc: 120,
      montant_ht: 100,
      defaultCurrency: "EUR",
    });

    expect(result).toEqual({
      montant_ttc_eur: 120,
      montant_ht_eur: 100,
      taux_change: 1,
      taux_change_date: "2026-04-10",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("converts amounts using the fetched rate when the currency differs", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ amount: 1, base: "USD", date: "2026-04-10", rates: { EUR: 0.5 } }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await convertExpenseAmounts({
      devise: "USD",
      date: new Date("2026-04-10T00:00:00.000Z"),
      montant_ttc: 200,
      montant_ht: 150,
      defaultCurrency: "EUR",
    });

    expect(result).toEqual({
      montant_ttc_eur: 100,
      montant_ht_eur: 75,
      taux_change: 0.5,
      taux_change_date: "2026-04-10",
    });
  });

  it("returns null amounts when the conversion fails instead of throwing", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}, false, 500));
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await convertExpenseAmounts({
      devise: "USD",
      date: new Date("2026-05-20T00:00:00.000Z"),
      montant_ttc: 200,
      montant_ht: 150,
      defaultCurrency: "EUR",
    });

    expect(result).toEqual({
      montant_ttc_eur: null,
      montant_ht_eur: null,
      taux_change: null,
      taux_change_date: null,
    });
  });
});
