const FRANKFURTER_BASE = "https://api.frankfurter.dev/v1";

export interface RateResult {
  rate: number;
  date: string;
}

interface FrankfurterResponse {
  amount: number;
  base: string;
  date: string;
  rates: Record<string, number>;
}

async function getRate(from: string, to: string, date: string): Promise<RateResult> {
  if (from === to) return { rate: 1, date };

  const url = `${FRANKFURTER_BASE}/${date}?from=${from}&to=${to}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Frankfurter error: ${res.status}`);
  }
  const data = (await res.json()) as FrankfurterResponse;
  const rate = data.rates[to];
  if (rate === undefined) {
    throw new Error(`Frankfurter: currency ${to} not found in response`);
  }
  return { rate, date: data.date };
}

const rateCache = new Map<string, RateResult>();

export async function getRateCached(from: string, to = "EUR", date: string): Promise<RateResult> {
  const key = `${from}-${to}-${date}`;
  const cached = rateCache.get(key);
  if (cached) return cached;
  const result = await getRate(from, to, date);
  rateCache.set(key, result);
  return result;
}

export async function listSupportedCurrencies(): Promise<Record<string, string>> {
  const res = await fetch(`${FRANKFURTER_BASE}/currencies`);
  if (!res.ok) {
    throw new Error(`Frankfurter error: ${res.status}`);
  }
  return (await res.json()) as Record<string, string>;
}

export async function convertExpenseAmounts(params: {
  devise: string;
  date: Date;
  montant_ttc: number | null;
  montant_ht: number | null;
  defaultCurrency: string;
}): Promise<{
  montant_ttc_eur: number | null;
  montant_ht_eur: number | null;
  taux_change: number | null;
  taux_change_date: string | null;
}> {
  const { devise, date, montant_ttc, montant_ht, defaultCurrency } = params;
  const dateStr = date.toISOString().slice(0, 10);

  if (devise === defaultCurrency) {
    return {
      montant_ttc_eur: montant_ttc,
      montant_ht_eur: montant_ht,
      taux_change: 1,
      taux_change_date: dateStr,
    };
  }

  try {
    const { rate, date: rateDate } = await getRateCached(devise, defaultCurrency, dateStr);
    return {
      montant_ttc_eur: montant_ttc !== null ? montant_ttc * rate : null,
      montant_ht_eur: montant_ht !== null ? montant_ht * rate : null,
      taux_change: rate,
      taux_change_date: rateDate,
    };
  } catch (err) {
    console.error("[currencyService] Conversion failed:", err);
    return {
      montant_ttc_eur: null,
      montant_ht_eur: null,
      taux_change: null,
      taux_change_date: null,
    };
  }
}
