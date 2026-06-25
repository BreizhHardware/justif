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

async function loginAs(opts: { email: string; role?: "admin" | "user"; active?: boolean }) {
  await createUser(opts);
  const client = new TestClient(server.baseUrl);
  await client.post("/api/auth/login", { email: opts.email, password: DEFAULT_PASSWORD });
  return client;
}

describe("/api/users admin guard", () => {
  it("rejects a non-admin user", async () => {
    const client = await loginAs({ email: "plain@justif.test", role: "user" });
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
    const admin = await loginAs({ email: "admin@justif.test", role: "admin" });
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
    const admin = await loginAs({ email: "admin2@justif.test", role: "admin" });
    const res = await admin.post("/api/users", {
      email: "new@justif.test",
      password: "longenough",
      role: "user",
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.email).toBe("new@justif.test");
    expect(body.role).toBe("user");
  });

  it("rejects a duplicate email", async () => {
    const admin = await loginAs({ email: "admin3@justif.test", role: "admin" });
    await createUser({ email: "dup@justif.test" });
    const res = await admin.post("/api/users", {
      email: "dup@justif.test",
      password: "longenough",
    });
    expect(res.status).toBe(409);
  });

  it("rejects a password shorter than 8 characters", async () => {
    const admin = await loginAs({ email: "admin4@justif.test", role: "admin" });
    const res = await admin.post("/api/users", { email: "weak@justif.test", password: "short" });
    expect(res.status).toBe(400);
  });

  it("rejects an invalid role", async () => {
    const admin = await loginAs({ email: "admin5@justif.test", role: "admin" });
    const res = await admin.post("/api/users", {
      email: "badrole@justif.test",
      password: "longenough",
      role: "superadmin",
    });
    expect(res.status).toBe(400);
  });
});

describe("PATCH /api/users/:id", () => {
  it("lets an admin promote a user to admin", async () => {
    const admin = await loginAs({ email: "admin6@justif.test", role: "admin" });
    const target = await createUser({ email: "promote@justif.test" });

    const res = await admin.patch(`/api/users/${target.id}`, { role: "admin" });
    expect(res.status).toBe(200);
    expect((await res.json()).role).toBe("admin");
  });

  it("prevents an admin from demoting themselves", async () => {
    const admin = await createUser({ email: "selfadmin@justif.test", role: "admin" });
    const client = new TestClient(server.baseUrl);
    await client.post("/api/auth/login", {
      email: "selfadmin@justif.test",
      password: DEFAULT_PASSWORD,
    });

    const res = await client.patch(`/api/users/${admin.id}`, { role: "user" });
    expect(res.status).toBe(400);
  });

  it("prevents an admin from deactivating themselves", async () => {
    const admin = await createUser({ email: "selfadmin2@justif.test", role: "admin" });
    const client = new TestClient(server.baseUrl);
    await client.post("/api/auth/login", {
      email: "selfadmin2@justif.test",
      password: DEFAULT_PASSWORD,
    });

    const res = await client.patch(`/api/users/${admin.id}`, { active: false });
    expect(res.status).toBe(400);
  });
});
