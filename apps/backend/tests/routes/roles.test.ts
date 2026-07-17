import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startTestServer, TestClient, type TestServer } from "../client.js";
import { createUser, DEFAULT_PASSWORD, getRoleIdByName } from "../fixtures.js";
import { PERMISSIONS } from "../../src/lib/permissions.js";
import { prisma } from "../../src/lib/prisma.js";

let server: TestServer;

beforeAll(async () => {
  server = await startTestServer();
});

afterAll(async () => {
  await server.close();
});

async function loginAs(opts: { email: string; roleNames?: string[] }) {
  await createUser(opts);
  const client = new TestClient(server.baseUrl);
  await client.post("/api/auth/login", { email: opts.email, password: DEFAULT_PASSWORD });
  return client;
}

describe("/api/roles permission guard", () => {
  it("rejects a non-admin user", async () => {
    const client = await loginAs({ email: "plain@justif.test", roleNames: ["User"] });
    const res = await client.get("/api/roles");
    expect(res.status).toBe(403);
  });

  it("rejects an unauthenticated request", async () => {
    const client = new TestClient(server.baseUrl);
    const res = await client.get("/api/roles");
    expect(res.status).toBe(401);
  });
});

describe("GET /api/roles", () => {
  it("lists the seeded system roles with their permissions and user counts", async () => {
    const admin = await loginAs({ email: "admin@justif.test", roleNames: ["Admin"] });
    const res = await admin.get("/api/roles");
    expect(res.status).toBe(200);
    const roles = (await res.json()) as Array<{
      name: string;
      permissions: string[];
      userCount: number;
    }>;
    const adminRole = roles.find((r) => r.name === "Admin")!;
    const userRole = roles.find((r) => r.name === "User")!;
    expect([...adminRole.permissions].sort()).toEqual([...PERMISSIONS].sort());
    expect(userRole.permissions).toEqual([]);
    expect(adminRole.userCount).toBe(1);
  });
});

describe("POST /api/roles", () => {
  it("creates a custom role with a subset of permissions", async () => {
    const admin = await loginAs({ email: "admin2@justif.test", roleNames: ["Admin"] });
    const res = await admin.post("/api/roles", {
      name: "Auditor",
      description: "Read-only audit access",
      permissions: ["VIEW_AUDIT_LOG"],
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.name).toBe("Auditor");
    expect(body.permissions).toEqual(["VIEW_AUDIT_LOG"]);
    expect(body.userCount).toBe(0);
  });

  it("rejects a duplicate role name", async () => {
    const admin = await loginAs({ email: "admin3@justif.test", roleNames: ["Admin"] });
    const res = await admin.post("/api/roles", { name: "Admin", permissions: [] });
    expect(res.status).toBe(409);
  });

  it("rejects an invalid permission", async () => {
    const admin = await loginAs({ email: "admin4@justif.test", roleNames: ["Admin"] });
    const res = await admin.post("/api/roles", {
      name: "BadRole",
      permissions: ["NOT_A_REAL_PERMISSION"],
    });
    expect(res.status).toBe(400);
  });

  it("rejects an empty name", async () => {
    const admin = await loginAs({ email: "admin5@justif.test", roleNames: ["Admin"] });
    const res = await admin.post("/api/roles", { name: "  ", permissions: [] });
    expect(res.status).toBe(400);
  });
});

describe("PATCH /api/roles/:id", () => {
  it("replaces the permission set", async () => {
    const admin = await loginAs({ email: "admin6@justif.test", roleNames: ["Admin"] });
    const created = await (
      await admin.post("/api/roles", { name: "OcrManager", permissions: ["CONFIG_OCR"] })
    ).json();

    const res = await admin.patch(`/api/roles/${created.id}`, {
      permissions: ["CONFIG_OCR", "VIEW_DASHBOARD"],
    });
    expect(res.status).toBe(200);
    expect([...(await res.json()).permissions].sort()).toEqual(["CONFIG_OCR", "VIEW_DASHBOARD"]);
  });
});

describe("DELETE /api/roles/:id", () => {
  it("deletes an unassigned role", async () => {
    const admin = await loginAs({ email: "admin7@justif.test", roleNames: ["Admin"] });
    const created = await (
      await admin.post("/api/roles", { name: "Temp", permissions: [] })
    ).json();

    const res = await admin.delete(`/api/roles/${created.id}`);
    expect(res.status).toBe(204);
  });

  it("refuses to delete a role that is still assigned to a user", async () => {
    const admin = await loginAs({ email: "admin8@justif.test", roleNames: ["Admin"] });
    await createUser({ email: "member8@justif.test", roleNames: ["User"] });
    const userRoleId = await getRoleIdByName("User");

    const res = await admin.delete(`/api/roles/${userRoleId}`);
    expect(res.status).toBe(409);

    const stillThere = await prisma.role.findUnique({ where: { id: userRoleId } });
    expect(stillThere).not.toBeNull();
  });
});
