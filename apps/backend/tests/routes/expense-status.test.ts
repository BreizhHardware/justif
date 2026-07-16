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

async function loginAs(opts: { email: string; roleNames?: string[] }) {
  const user = await createUser(opts);
  const client = new TestClient(server.baseUrl);
  await client.post("/api/auth/login", { email: opts.email, password: DEFAULT_PASSWORD });
  return { client, user };
}

function expensePayload(overrides: Record<string, unknown> = {}) {
  return {
    date: "2026-01-15",
    fournisseur: "Status Test Vendor",
    categorie: "Repas",
    devise: "EUR",
    montant_ttc: 50,
    ...overrides,
  };
}

describe("expense status — initial state", () => {
  it("new expenses default to 'draft'", async () => {
    const { client } = await loginAs({ email: "status-draft@justif.test" });
    const res = await client.post("/api/expenses", expensePayload());
    expect(res.status).toBe(201);
    expect((await res.json()).status).toBe("draft");
  });
});

describe("PATCH /api/expenses/:id/status — validation workflow disabled (default)", () => {
  it("owner can archive a draft expense", async () => {
    const { client } = await loginAs({ email: "archive-draft@justif.test" });
    const expense = await (await client.post("/api/expenses", expensePayload())).json();

    const res = await client.patch(`/api/expenses/${expense.id}/status`, { status: "archived" });
    expect(res.status).toBe(200);
    expect((await res.json()).status).toBe("archived");
  });

  it("owner cannot submit for review when validation is disabled", async () => {
    const { client } = await loginAs({ email: "no-review@justif.test" });
    const expense = await (await client.post("/api/expenses", expensePayload())).json();

    const res = await client.patch(`/api/expenses/${expense.id}/status`, {
      status: "pending_review",
    });
    expect(res.status).toBe(400);
  });

  it("cannot manually set status to 'exported'", async () => {
    const { client } = await loginAs({ email: "no-export-manual@justif.test" });
    const expense = await (await client.post("/api/expenses", expensePayload())).json();

    const res = await client.patch(`/api/expenses/${expense.id}/status`, { status: "exported" });
    expect(res.status).toBe(400);
  });

  it("rejects an invalid status value", async () => {
    const { client } = await loginAs({ email: "invalid-status@justif.test" });
    const expense = await (await client.post("/api/expenses", expensePayload())).json();

    const res = await client.patch(`/api/expenses/${expense.id}/status`, {
      status: "in_progress",
    });
    expect(res.status).toBe(400);
  });

  it("non-owner non-admin cannot change the status", async () => {
    const { client: owner } = await loginAs({ email: "status-owner@justif.test" });
    const { client: other } = await loginAs({ email: "status-other@justif.test" });
    const expense = await (await owner.post("/api/expenses", expensePayload())).json();

    const res = await other.patch(`/api/expenses/${expense.id}/status`, { status: "archived" });
    expect(res.status).toBe(403);
  });
});

describe("PATCH /api/expenses/:id/status — validation workflow enabled", () => {
  async function enableValidation() {
    await prisma.setting.upsert({
      where: { key: "require_validation" },
      update: { value: "true" },
      create: { key: "require_validation", value: "true" },
    });
  }

  async function disableValidation() {
    await prisma.setting.upsert({
      where: { key: "require_validation" },
      update: { value: "false" },
      create: { key: "require_validation", value: "false" },
    });
  }

  it("owner can submit draft for review when validation is enabled", async () => {
    await enableValidation();
    try {
      const { client } = await loginAs({ email: "submit-review@justif.test" });
      const expense = await (await client.post("/api/expenses", expensePayload())).json();

      const res = await client.patch(`/api/expenses/${expense.id}/status`, {
        status: "pending_review",
      });
      expect(res.status).toBe(200);
      expect((await res.json()).status).toBe("pending_review");
    } finally {
      await disableValidation();
    }
  });

  it("admin can validate a pending_review expense", async () => {
    await enableValidation();
    try {
      const { client: user } = await loginAs({ email: "member-validate@justif.test" });
      const { client: admin } = await loginAs({ email: "admin-validate@justif.test", roleNames: ["Admin"] });
      const expense = await (await user.post("/api/expenses", expensePayload())).json();

      await user.patch(`/api/expenses/${expense.id}/status`, { status: "pending_review" });

      const res = await admin.patch(`/api/expenses/${expense.id}/status`, { status: "validated" });
      expect(res.status).toBe(200);
      expect((await res.json()).status).toBe("validated");
    } finally {
      await disableValidation();
    }
  });

  it("admin can reject (send back to draft) a pending_review expense", async () => {
    await enableValidation();
    try {
      const { client: user } = await loginAs({ email: "member-reject@justif.test" });
      const { client: admin } = await loginAs({ email: "admin-reject@justif.test", roleNames: ["Admin"] });
      const expense = await (await user.post("/api/expenses", expensePayload())).json();

      await user.patch(`/api/expenses/${expense.id}/status`, { status: "pending_review" });

      const res = await admin.patch(`/api/expenses/${expense.id}/status`, { status: "draft" });
      expect(res.status).toBe(200);
      expect((await res.json()).status).toBe("draft");
    } finally {
      await disableValidation();
    }
  });

  it("non-admin cannot validate a pending_review expense", async () => {
    await enableValidation();
    try {
      const { client: user } = await loginAs({ email: "member-cant-validate@justif.test" });
      const { client: other } = await loginAs({ email: "other-cant-validate@justif.test" });
      const expense = await (await user.post("/api/expenses", expensePayload())).json();

      await user.patch(`/api/expenses/${expense.id}/status`, { status: "pending_review" });

      const res = await other.patch(`/api/expenses/${expense.id}/status`, { status: "validated" });
      expect(res.status).toBe(403);
    } finally {
      await disableValidation();
    }
  });
});

describe("export sets status to 'exported'", () => {
  it("exporting expenses marks them as 'exported'", async () => {
    const { client, user } = await loginAs({ email: "export-status@justif.test" });
    const expense = await (await client.post("/api/expenses", expensePayload())).json();
    expect(expense.status).toBe("draft");

    const exportRes = await client.get("/api/expenses/export");
    expect(exportRes.status).toBe(200);

    const updated = await prisma.expense.findUniqueOrThrow({ where: { id: expense.id } });
    expect(updated.status).toBe("exported");

    // Cleanup
    await prisma.expenseReport.deleteMany({ where: { userId: user.id } });
  });

  it("admin can archive an exported expense", async () => {
    const { client: user, user: userRecord } = await loginAs({ email: "export-then-archive@justif.test" });
    const { client: admin } = await loginAs({ email: "admin-archive-exported@justif.test", roleNames: ["Admin"] });
    const expense = await (await user.post("/api/expenses", expensePayload())).json();

    await user.get("/api/expenses/export");

    const res = await admin.patch(`/api/expenses/${expense.id}/status`, { status: "archived" });
    expect(res.status).toBe(200);
    expect((await res.json()).status).toBe("archived");

    // Cleanup
    await prisma.expenseReport.deleteMany({ where: { userId: userRecord.id } });
  });
});

describe("GET /api/expenses — status filter", () => {
  it("filters expenses by status", async () => {
    const { client } = await loginAs({ email: "filter-status@justif.test" });
    const e1 = await (await client.post("/api/expenses", expensePayload({ fournisseur: "A" }))).json();
    await (await client.post("/api/expenses", expensePayload({ fournisseur: "B" }))).json();

    // Archive the first expense
    await client.patch(`/api/expenses/${e1.id}/status`, { status: "archived" });

    const drafts = await (await client.get("/api/expenses?status=draft")).json();
    expect(drafts.total).toBe(1);
    expect(drafts.data[0].fournisseur).toBe("B");

    const archived = await (await client.get("/api/expenses?status=archived")).json();
    expect(archived.total).toBe(1);
    expect(archived.data[0].fournisseur).toBe("A");
  });
});
