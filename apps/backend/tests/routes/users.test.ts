import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startTestServer, TestClient, type TestServer } from "../client.js";
import { createUser, DEFAULT_PASSWORD, getRoleIdByName } from "../fixtures.js";

let server: TestServer;

beforeAll(async () => {
  server = await startTestServer();
});

afterAll(async () => {
  await server.close();
});

async function loginAs(opts: { email: string; roleNames?: string[]; active?: boolean }) {
  await createUser(opts);
  const client = new TestClient(server.baseUrl);
  await client.post("/api/auth/login", { email: opts.email, password: DEFAULT_PASSWORD });
  return client;
}

describe("/api/users permission guard", () => {
  it("rejects a non-admin user", async () => {
    const client = await loginAs({ email: "plain@justif.test", roleNames: ["User"] });
    const res = await client.get("/api/users");
    expect(res.status).toBe(403);
  });

  it("rejects an unauthenticated request", async () => {
    const client = new TestClient(server.baseUrl);
    const res = await client.get("/api/users");
    expect(res.status).toBe(401);
  });
});

describe("GET /api/users", () => {
  it("lists users without exposing the password hash, for an admin", async () => {
    const admin = await loginAs({ email: "admin@justif.test", roleNames: ["Admin"] });
    await createUser({ email: "member@justif.test" });

    const res = await admin.get("/api/users");
    expect(res.status).toBe(200);
    const users = (await res.json()) as Array<Record<string, unknown>>;
    expect(users.map((u) => u.email).sort()).toEqual(["admin@justif.test", "member@justif.test"]);
    expect(users[0].passwordHash).toBeUndefined();
  });
});

describe("POST /api/users", () => {
  it("lets an admin create a new user", async () => {
    const admin = await loginAs({ email: "admin2@justif.test", roleNames: ["Admin"] });
    const userRoleId = await getRoleIdByName("User");
    const res = await admin.post("/api/users", {
      email: "new@justif.test",
      password: "longenough",
      roleIds: [userRoleId],
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.email).toBe("new@justif.test");
    expect(body.roles.map((r: { name: string }) => r.name)).toEqual(["User"]);
  });

  it("defaults to the User role when roleIds is omitted", async () => {
    const admin = await loginAs({ email: "admin2b@justif.test", roleNames: ["Admin"] });
    const res = await admin.post("/api/users", {
      email: "defaultrole@justif.test",
      password: "longenough",
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.roles.map((r: { name: string }) => r.name)).toEqual(["User"]);
  });

  it("rejects a duplicate email", async () => {
    const admin = await loginAs({ email: "admin3@justif.test", roleNames: ["Admin"] });
    await createUser({ email: "dup@justif.test" });
    const res = await admin.post("/api/users", {
      email: "dup@justif.test",
      password: "longenough",
    });
    expect(res.status).toBe(409);
  });

  it("rejects a password shorter than 8 characters", async () => {
    const admin = await loginAs({ email: "admin4@justif.test", roleNames: ["Admin"] });
    const res = await admin.post("/api/users", { email: "weak@justif.test", password: "short" });
    expect(res.status).toBe(400);
  });

  it("rejects an unknown roleId", async () => {
    const admin = await loginAs({ email: "admin5@justif.test", roleNames: ["Admin"] });
    const res = await admin.post("/api/users", {
      email: "badrole@justif.test",
      password: "longenough",
      roleIds: ["nonexistent-role-id"],
    });
    expect(res.status).toBe(400);
  });
});

describe("PATCH /api/users/:id", () => {
  it("lets an admin promote a user to admin", async () => {
    const admin = await loginAs({ email: "admin6@justif.test", roleNames: ["Admin"] });
    const target = await createUser({ email: "promote@justif.test" });
    const adminRoleId = await getRoleIdByName("Admin");

    const res = await admin.patch(`/api/users/${target.id}`, { roleIds: [adminRoleId] });
    expect(res.status).toBe(200);
    expect((await res.json()).roles.map((r: { name: string }) => r.name)).toEqual(["Admin"]);
  });

  it("prevents an admin from removing their own user-management access", async () => {
    const admin = await createUser({ email: "selfadmin@justif.test", roleNames: ["Admin"] });
    const client = new TestClient(server.baseUrl);
    await client.post("/api/auth/login", {
      email: "selfadmin@justif.test",
      password: DEFAULT_PASSWORD,
    });
    const userRoleId = await getRoleIdByName("User");

    const res = await client.patch(`/api/users/${admin.id}`, { roleIds: [userRoleId] });
    expect(res.status).toBe(400);
  });

  it("prevents an admin from deactivating themselves", async () => {
    const admin = await createUser({ email: "selfadmin2@justif.test", roleNames: ["Admin"] });
    const client = new TestClient(server.baseUrl);
    await client.post("/api/auth/login", {
      email: "selfadmin2@justif.test",
      password: DEFAULT_PASSWORD,
    });

    const res = await client.patch(`/api/users/${admin.id}`, { active: false });
    expect(res.status).toBe(400);
  });
});
