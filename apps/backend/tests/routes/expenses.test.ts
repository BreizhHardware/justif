import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startTestServer, TestClient, type TestServer } from "../client.js";
import { createUser, DEFAULT_PASSWORD } from "../fixtures.js";
import { prisma } from "../../src/lib/prisma.js";

let server: TestServer;

beforeAll(async () => {
  server = await startTestServer();
});

afterAll(async () => {
  await server.close();
});

async function loginAs(opts: { email: string; role?: "admin" | "user" }) {
  const user = await createUser(opts);
  const client = new TestClient(server.baseUrl);
  await client.post("/api/auth/login", { email: opts.email, password: DEFAULT_PASSWORD });
  return { client, user };
}

function expensePayload(overrides: Record<string, unknown> = {}) {
  return {
    date: "2026-01-15",
    fournisseur: "Fournisseur Test",
    categorie: "Repas",
    devise: "EUR",
    montant_ttc: 120,
    montant_ht: 100,
    ...overrides,
  };
}

describe("ownership scoping", () => {
  it("only returns the authenticated user's own expenses", async () => {
    const { client: alice } = await loginAs({ email: "alice@justif.test" });
    const { client: bob } = await loginAs({ email: "bob@justif.test" });

    await alice.post("/api/expenses", expensePayload());

    const aliceList = await alice.get("/api/expenses");
    expect((await aliceList.json()).total).toBe(1);

    const bobList = await bob.get("/api/expenses");
    expect((await bobList.json()).total).toBe(0);
  });

  it("lets an admin view another user's expenses via ?userId=", async () => {
    const { client: member, user } = await loginAs({ email: "member@justif.test" });
    const { client: admin } = await loginAs({ email: "admin@justif.test", role: "admin" });
    await member.post("/api/expenses", expensePayload());

    const res = await admin.get(`/api/expenses?userId=${user.id}`);
    expect(res.status).toBe(200);
    expect((await res.json()).total).toBe(1);
  });

  it("forbids a non-admin from viewing another user's expenses via ?userId=", async () => {
    const { client: member, user } = await loginAs({ email: "member2@justif.test" });
    const { client: other } = await loginAs({ email: "other@justif.test" });
    await member.post("/api/expenses", expensePayload());

    const res = await other.get(`/api/expenses?userId=${user.id}`);
    expect(res.status).toBe(403);
  });
});

describe("POST /api/expenses", () => {
  it("creates an expense owned by the authenticated user, defaulting the category", async () => {
    const { client, user } = await loginAs({ email: "creator@justif.test" });

    const res = await client.post("/api/expenses", expensePayload({ categorie: undefined }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.categorie).toBe("Autre");
    expect(body.userId).toBe(user.id);
    expect(body.montant_ttc_eur).toBe(120);
    expect(body.taux_change).toBe(1);
  });

  it("rejects an expense without a date", async () => {
    const { client } = await loginAs({ email: "nodate@justif.test" });
    const res = await client.post("/api/expenses", expensePayload({ date: undefined }));
    expect(res.status).toBe(400);
  });
});

describe("PATCH /api/expenses/:id", () => {
  it("lets the owner update their own expense", async () => {
    const { client } = await loginAs({ email: "owner@justif.test" });
    const created = await (await client.post("/api/expenses", expensePayload())).json();

    const res = await client.patch(`/api/expenses/${created.id}`, {
      fournisseur: "Nouveau fournisseur",
    });
    expect(res.status).toBe(200);
    expect((await res.json()).fournisseur).toBe("Nouveau fournisseur");
  });

  it("forbids another non-admin user from updating someone else's expense", async () => {
    const { client: owner } = await loginAs({ email: "owner2@justif.test" });
    const { client: intruder } = await loginAs({ email: "intruder@justif.test" });
    const created = await (await owner.post("/api/expenses", expensePayload())).json();

    const res = await intruder.patch(`/api/expenses/${created.id}`, { fournisseur: "Hacked" });
    expect(res.status).toBe(403);
  });

  it("lets an admin update another user's expense", async () => {
    const { client: owner } = await loginAs({ email: "owner3@justif.test" });
    const { client: admin } = await loginAs({ email: "admin2@justif.test", role: "admin" });
    const created = await (await owner.post("/api/expenses", expensePayload())).json();

    const res = await admin.patch(`/api/expenses/${created.id}`, {
      fournisseur: "Modifié par admin",
    });
    expect(res.status).toBe(200);
  });

  it("returns 404 for a non-existent expense", async () => {
    const { client } = await loginAs({ email: "missing@justif.test" });
    const res = await client.patch("/api/expenses/does-not-exist", { fournisseur: "x" });
    expect(res.status).toBe(404);
  });
});

describe("POST /api/expenses/:id/recalculate", () => {
  it("recomputes the converted amounts for an expense", async () => {
    const { client } = await loginAs({ email: "recalc@justif.test" });
    const created = await (await client.post("/api/expenses", expensePayload())).json();

    const res = await client.post(`/api/expenses/${created.id}/recalculate`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.montant_ttc_eur).toBe(120);
    expect(body.taux_change).toBe(1);
  });

  it("forbids a non-owner, non-admin from recalculating", async () => {
    const { client: owner } = await loginAs({ email: "owner4@justif.test" });
    const { client: intruder } = await loginAs({ email: "intruder2@justif.test" });
    const created = await (await owner.post("/api/expenses", expensePayload())).json();

    const res = await intruder.post(`/api/expenses/${created.id}/recalculate`);
    expect(res.status).toBe(403);
  });
});

describe("DELETE /api/expenses/:id", () => {
  it("lets the owner delete their own expense", async () => {
    const { client } = await loginAs({ email: "deleter@justif.test" });
    const created = await (await client.post("/api/expenses", expensePayload())).json();

    const res = await client.delete(`/api/expenses/${created.id}`);
    expect(res.status).toBe(204);

    const after = await client.get("/api/expenses");
    expect((await after.json()).total).toBe(0);
  });

  it("forbids a non-owner, non-admin from deleting", async () => {
    const { client: owner } = await loginAs({ email: "owner5@justif.test" });
    const { client: intruder } = await loginAs({ email: "intruder3@justif.test" });
    const created = await (await owner.post("/api/expenses", expensePayload())).json();

    const res = await intruder.delete(`/api/expenses/${created.id}`);
    expect(res.status).toBe(403);
  });
});

describe("export, export-overlap and report tracking", () => {
  it("creates a report on export and reports overlap on a subsequent export", async () => {
    const { client, user } = await loginAs({ email: "exporter@justif.test" });
    await client.post("/api/expenses", expensePayload({ fournisseur: "A" }));
    await client.post("/api/expenses", expensePayload({ fournisseur: "B" }));

    const overlapBefore = await client.get("/api/expenses/export-overlap");
    expect(await overlapBefore.json()).toEqual({ total: 2, freshCount: 2, previousReports: [] });

    const exportRes = await client.get("/api/expenses/export");
    expect(exportRes.status).toBe(200);
    expect(exportRes.headers.get("content-type")).toContain("spreadsheetml");

    const reports = await prisma.expenseReport.findMany({ where: { userId: user.id } });
    expect(reports).toHaveLength(1);
    const items = await prisma.expenseReportItem.findMany({ where: { reportId: reports[0].id } });
    expect(items).toHaveLength(2);

    const overlapAfter = await client.get("/api/expenses/export-overlap");
    const afterBody = await overlapAfter.json();
    expect(afterBody.total).toBe(2);
    expect(afterBody.freshCount).toBe(0);
    expect(afterBody.previousReports).toHaveLength(1);
    expect(afterBody.previousReports[0].count).toBe(2);

    await client.post("/api/expenses", expensePayload({ fournisseur: "C" }));
    const overlapWithFresh = await client.get("/api/expenses/export-overlap");
    const freshBody = await overlapWithFresh.json();
    expect(freshBody.total).toBe(3);
    expect(freshBody.freshCount).toBe(1);
  });

  it("excludes already-reported expenses from a new export unless explicitly re-included", async () => {
    const { client, user } = await loginAs({ email: "exporter2@justif.test" });
    await client.post("/api/expenses", expensePayload({ fournisseur: "A" }));

    await client.get("/api/expenses/export");
    const firstReport = await prisma.expenseReport.findFirstOrThrow({ where: { userId: user.id } });

    await client.post("/api/expenses", expensePayload({ fournisseur: "D" }));

    await client.get("/api/expenses/export");
    const reportsAfterSecondExport = await prisma.expenseReport.findMany({
      where: { userId: user.id },
    });
    expect(reportsAfterSecondExport).toHaveLength(2);
    const secondReport = reportsAfterSecondExport.find((r) => r.id !== firstReport.id)!;
    const secondItems = await prisma.expenseReportItem.findMany({
      where: { reportId: secondReport.id },
    });
    expect(secondItems).toHaveLength(1);

    await client.post("/api/expenses", expensePayload({ fournisseur: "E" }));
    await client.get(`/api/expenses/export?includeReportIds=${firstReport.id}`);
    const reportsAfterThirdExport = await prisma.expenseReport.findMany({
      where: { userId: user.id },
    });
    const thirdReport = reportsAfterThirdExport.find(
      (r) => r.id !== firstReport.id && r.id !== secondReport.id,
    )!;
    const thirdItems = await prisma.expenseReportItem.findMany({
      where: { reportId: thirdReport.id },
    });
    expect(thirdItems).toHaveLength(2);
  });
});
