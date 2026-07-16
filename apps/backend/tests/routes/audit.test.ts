import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startTestServer, TestClient, type TestServer } from "../client.js";
import { createUser, DEFAULT_PASSWORD, getRoleIdByName } from "../fixtures.js";
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

// ---------------------------------------------------------------------------
// Access control
// ---------------------------------------------------------------------------

describe("GET /api/audit — access control", () => {
  it("rejects unauthenticated requests", async () => {
    const client = new TestClient(server.baseUrl);
    const res = await client.get("/api/audit");
    expect(res.status).toBe(401);
  });

  it("rejects non-admin users", async () => {
    const { client } = await loginAs({ email: "user@audit-access.test" });
    const res = await client.get("/api/audit");
    expect(res.status).toBe(403);
  });

  it("allows admin users and returns paginated structure", async () => {
    const { client } = await loginAs({ email: "admin@audit-access.test", roleNames: ["Admin"] });
    const res = await client.get("/api/audit");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("data");
    expect(body).toHaveProperty("total");
    expect(body).toHaveProperty("page");
    expect(body).toHaveProperty("pages");
  });
});

// ---------------------------------------------------------------------------
// Auth events
// ---------------------------------------------------------------------------

describe("audit trail — auth events", () => {
  it("records auth.login on successful login", async () => {
    const user = await createUser({ email: "ok@audit-login.test" });
    const client = new TestClient(server.baseUrl);
    await client.post("/api/auth/login", {
      email: "ok@audit-login.test",
      password: DEFAULT_PASSWORD,
    });

    const log = await prisma.auditLog.findFirst({
      where: { userId: user.id, action: "auth.login" },
    });
    expect(log).not.toBeNull();
  });

  it("records auth.login_failed with reason=invalid_credentials on bad password", async () => {
    await createUser({ email: "bad@audit-login.test" });
    const client = new TestClient(server.baseUrl);
    await client.post("/api/auth/login", {
      email: "bad@audit-login.test",
      password: "wrongpassword",
    });

    const log = await prisma.auditLog.findFirst({
      where: { action: "auth.login_failed", metadata: { contains: "invalid_credentials" } },
    });
    expect(log).not.toBeNull();
    expect(log!.userId).toBeNull();
  });

  it("records auth.login_failed with reason=account_disabled for inactive accounts", async () => {
    const user = await createUser({ email: "disabled@audit-login.test", active: false });
    const client = new TestClient(server.baseUrl);
    await client.post("/api/auth/login", {
      email: "disabled@audit-login.test",
      password: DEFAULT_PASSWORD,
    });

    const log = await prisma.auditLog.findFirst({
      where: { userId: user.id, action: "auth.login_failed" },
    });
    expect(log).not.toBeNull();
    expect(JSON.parse(log!.metadata!).reason).toBe("account_disabled");
  });
});

// ---------------------------------------------------------------------------
// Expense events
// ---------------------------------------------------------------------------

describe("audit trail — expense events", () => {
  it("records expense.create with categorie and devise in metadata", async () => {
    const { client, user } = await loginAs({ email: "creator@audit-expense.test" });
    const res = await client.post("/api/expenses", {
      date: "2026-03-01",
      categorie: "Repas",
      devise: "EUR",
      montant_ttc: 50,
    });
    expect(res.status).toBe(201);
    const expense = await res.json();

    const log = await prisma.auditLog.findFirst({
      where: { userId: user.id, action: "expense.create", entityId: expense.id },
    });
    expect(log).not.toBeNull();
    expect(log!.entityType).toBe("Expense");
    const meta = JSON.parse(log!.metadata!);
    expect(meta.categorie).toBe("Repas");
    expect(meta.devise).toBe("EUR");
  });

  it("records expense.update with the list of changed field names", async () => {
    const { client, user } = await loginAs({ email: "updater@audit-expense.test" });
    const created = await (
      await client.post("/api/expenses", {
        date: "2026-03-01",
        categorie: "Repas",
        devise: "EUR",
        montant_ttc: 50,
      })
    ).json();

    await client.patch(`/api/expenses/${created.id}`, { categorie: "Transport" });

    const log = await prisma.auditLog.findFirst({
      where: { userId: user.id, action: "expense.update", entityId: created.id },
    });
    expect(log).not.toBeNull();
    const meta = JSON.parse(log!.metadata!);
    expect(meta.fields).toContain("categorie");
  });

  it("records expense.delete with a snapshot of the deleted expense", async () => {
    const { client, user } = await loginAs({ email: "deleter@audit-expense.test" });
    const created = await (
      await client.post("/api/expenses", {
        date: "2026-03-01",
        categorie: "Hébergement",
        devise: "EUR",
        montant_ttc: 199,
      })
    ).json();

    await client.delete(`/api/expenses/${created.id}`);

    const log = await prisma.auditLog.findFirst({
      where: { userId: user.id, action: "expense.delete", entityId: created.id },
    });
    expect(log).not.toBeNull();
    // Snapshot must survive deletion of the entity.
    const meta = JSON.parse(log!.metadata!);
    expect(meta.montant_ttc).toBe(199);
    expect(meta.categorie).toBe("Hébergement");
  });

  it("records expense.recalculate", async () => {
    const { client, user } = await loginAs({ email: "recalc@audit-expense.test" });
    const created = await (
      await client.post("/api/expenses", {
        date: "2026-03-01",
        categorie: "Repas",
        devise: "EUR",
        montant_ttc: 30,
      })
    ).json();

    await client.post(`/api/expenses/${created.id}/recalculate`);

    const log = await prisma.auditLog.findFirst({
      where: { userId: user.id, action: "expense.recalculate", entityId: created.id },
    });
    expect(log).not.toBeNull();
  });

  it("sets targetUserId when an admin edits another user's expense", async () => {
    const { client: member, user: memberUser } = await loginAs({
      email: "member@audit-cross.test",
    });
    const { client: admin, user: adminUser } = await loginAs({
      email: "admin@audit-cross.test",
      roleNames: ["Admin"],
    });

    const created = await (
      await member.post("/api/expenses", {
        date: "2026-03-01",
        categorie: "Repas",
        devise: "EUR",
        montant_ttc: 75,
      })
    ).json();

    await admin.patch(`/api/expenses/${created.id}`, { categorie: "Transport" });

    const log = await prisma.auditLog.findFirst({
      where: { userId: adminUser.id, action: "expense.update", entityId: created.id },
    });
    expect(log).not.toBeNull();
    expect(log!.targetUserId).toBe(memberUser.id);
  });
});

// ---------------------------------------------------------------------------
// User management events
// ---------------------------------------------------------------------------

describe("audit trail — user management", () => {
  it("records user.create with email and role snapshot", async () => {
    const { client: admin, user: adminUser } = await loginAs({
      email: "admin@audit-users.test",
      roleNames: ["Admin"],
    });
    const userRoleId = await getRoleIdByName("User");
    const res = await admin.post("/api/users", {
      email: "newmember@audit-users.test",
      password: DEFAULT_PASSWORD,
      roleIds: [userRoleId],
    });
    expect(res.status).toBe(201);
    const created = await res.json();

    const log = await prisma.auditLog.findFirst({
      where: { userId: adminUser.id, action: "user.create", entityId: created.id },
    });
    expect(log).not.toBeNull();
    const meta = JSON.parse(log!.metadata!);
    expect(meta.email).toBe("newmember@audit-users.test");
    expect(meta.roles).toEqual(["User"]);
  });

  it("records user.update with role change in metadata", async () => {
    const { client: admin, user: adminUser } = await loginAs({
      email: "admin2@audit-users.test",
      roleNames: ["Admin"],
    });
    const target = await createUser({ email: "promoted@audit-users.test" });
    const adminRoleId = await getRoleIdByName("Admin");
    await admin.patch(`/api/users/${target.id}`, { roleIds: [adminRoleId] });

    const log = await prisma.auditLog.findFirst({
      where: { userId: adminUser.id, action: "user.update", entityId: target.id },
    });
    expect(log).not.toBeNull();
    const meta = JSON.parse(log!.metadata!);
    expect(meta.changes.roles).toEqual(["Admin"]);
    expect(meta.changes).not.toHaveProperty("passwordChanged"); // password not changed
  });

  it("records passwordChanged flag without exposing password value", async () => {
    const { client: admin, user: adminUser } = await loginAs({
      email: "admin3@audit-users.test",
      roleNames: ["Admin"],
    });
    const target = await createUser({ email: "pwdchange@audit-users.test" });
    await admin.patch(`/api/users/${target.id}`, { password: "newpassword123" });

    const log = await prisma.auditLog.findFirst({
      where: { userId: adminUser.id, action: "user.update", entityId: target.id },
    });
    expect(log).not.toBeNull();
    const meta = JSON.parse(log!.metadata!);
    expect(meta.changes.passwordChanged).toBe(true);
    // The actual password value must never appear in the audit log.
    expect(log!.metadata).not.toContain("newpassword123");
  });
});

// ---------------------------------------------------------------------------
// Filtering and pagination
// ---------------------------------------------------------------------------

describe("GET /api/audit — filtering", () => {
  it("filters results by action type", async () => {
    const { client } = await loginAs({ email: "admin@audit-filter.test", roleNames: ["Admin"] });

    const res = await client.get("/api/audit?action=auth.login");
    expect(res.status).toBe(200);
    const body = await res.json();
    const allMatch = body.data.every(
      (log: { action: string }) => log.action === "auth.login",
    );
    expect(allMatch).toBe(true);
  });

  it("filters results by userId", async () => {
    const { client: admin } = await loginAs({ email: "admin@audit-filter2.test", roleNames: ["Admin"] });
    const target = await createUser({ email: "target@audit-filter.test" });
    const targetClient = new TestClient(server.baseUrl);
    await targetClient.post("/api/auth/login", {
      email: "target@audit-filter.test",
      password: DEFAULT_PASSWORD,
    });

    const res = await admin.get(`/api/audit?userId=${target.id}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.length).toBeGreaterThan(0);
    const allMatch = body.data.every(
      (log: { userId: string | null }) => log.userId === target.id,
    );
    expect(allMatch).toBe(true);
  });

  it("returns at most `limit` results per page", async () => {
    const { client } = await loginAs({ email: "admin@audit-page.test", roleNames: ["Admin"] });

    const res = await client.get("/api/audit?page=1&limit=3");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.length).toBeLessThanOrEqual(3);
    expect(body.page).toBe(1);
  });
});
