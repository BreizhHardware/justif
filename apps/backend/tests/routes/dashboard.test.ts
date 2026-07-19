import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startTestServer, TestClient, type TestServer } from "../client.js";
import { createUser, DEFAULT_PASSWORD } from "../fixtures.js";

let server: TestServer;

beforeAll(async () => {
  server = await startTestServer();
});

afterAll(async () => {
  await server.close();
});

async function loginAs(email: string) {
  await createUser({ email });
  const client = new TestClient(server.baseUrl);
  await client.post("/api/auth/login", { email, password: DEFAULT_PASSWORD });
  return client;
}

function expensePayload(overrides: Record<string, unknown> = {}) {
  return {
    date: "2026-01-15",
    fournisseur: "Acme Corp",
    categorie: "Repas",
    devise: "EUR",
    montant_ttc: 50,
    ...overrides,
  };
}

describe("GET /api/dashboard/summary - byVendor", () => {
  it("groups expenses by vendor (fournisseur)", async () => {
    const client = await loginAs("dash-vendor@justif.test");
    await client.post(
      "/api/expenses",
      expensePayload({ fournisseur: "Acme Corp", montant_ttc: 50 }),
    );
    await client.post(
      "/api/expenses",
      expensePayload({ fournisseur: "Acme Corp", montant_ttc: 30 }),
    );
    await client.post("/api/expenses", expensePayload({ fournisseur: "Globex", montant_ttc: 20 }));

    const res = await client.get("/api/dashboard/summary");
    expect(res.status).toBe(200);
    const body = await res.json();

    const acme = body.byVendor.find((v: { fournisseur: string }) => v.fournisseur === "Acme Corp");
    const globex = body.byVendor.find((v: { fournisseur: string }) => v.fournisseur === "Globex");
    expect(acme).toEqual({ fournisseur: "Acme Corp", sum: 80, count: 2 });
    expect(globex).toEqual({ fournisseur: "Globex", sum: 20, count: 1 });
  });

  it("groups expenses with no vendor under a null key", async () => {
    const client = await loginAs("dash-vendor-null@justif.test");
    await client.post("/api/expenses", expensePayload({ fournisseur: undefined, montant_ttc: 15 }));

    const res = await client.get("/api/dashboard/summary");
    const body = await res.json();

    const unknown = body.byVendor.find(
      (v: { fournisseur: string | null }) => v.fournisseur === null,
    );
    expect(unknown).toEqual({ fournisseur: null, sum: 15, count: 1 });
  });
});

describe("GET /api/dashboard/summary - granularity", () => {
  it("defaults to monthly grouping", async () => {
    const client = await loginAs("dash-month@justif.test");
    await client.post("/api/expenses", expensePayload({ date: "2026-01-05", montant_ttc: 10 }));
    await client.post("/api/expenses", expensePayload({ date: "2026-01-20", montant_ttc: 15 }));

    const res = await client.get("/api/dashboard/summary");
    const body = await res.json();

    expect(body.granularity).toBe("month");
    expect(body.byMonth).toEqual([{ month: "2026-01", count: 2, sum: 25 }]);
  });

  it("groups by day when granularity=day", async () => {
    const client = await loginAs("dash-day@justif.test");
    await client.post("/api/expenses", expensePayload({ date: "2026-01-05", montant_ttc: 10 }));
    await client.post("/api/expenses", expensePayload({ date: "2026-01-20", montant_ttc: 15 }));

    const res = await client.get("/api/dashboard/summary?granularity=day");
    const body = await res.json();

    expect(body.granularity).toBe("day");
    expect(body.byMonth).toEqual([
      { month: "2026-01-05", count: 1, sum: 10 },
      { month: "2026-01-20", count: 1, sum: 15 },
    ]);
  });

  it("falls back to monthly grouping for an unrecognised granularity value", async () => {
    const client = await loginAs("dash-invalid-granularity@justif.test");
    await client.post("/api/expenses", expensePayload({ date: "2026-01-05", montant_ttc: 10 }));

    const res = await client.get("/api/dashboard/summary?granularity=year");
    const body = await res.json();

    expect(body.granularity).toBe("month");
  });
});
