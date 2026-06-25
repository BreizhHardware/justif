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

describe("GET /api/auth/status", () => {
  it("reports setupComplete = false when no user exists", async () => {
    const client = new TestClient(server.baseUrl);
    const res = await client.get("/api/auth/status");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ setupComplete: false });
  });

  it("reports setupComplete = true once a user exists", async () => {
    await createUser({ email: "admin@justif.test" });
    const client = new TestClient(server.baseUrl);
    const res = await client.get("/api/auth/status");
    expect(await res.json()).toEqual({ setupComplete: true });
  });
});

describe("POST /api/auth/setup", () => {
  it("creates the first admin account and sets a session cookie", async () => {
    const client = new TestClient(server.baseUrl);
    const res = await client.post("/api/auth/setup", {
      email: "first@justif.test",
      password: "supersecret",
    });
    expect(res.status).toBe(200);

    const created = await prisma.user.findUnique({ where: { email: "first@justif.test" } });
    expect(created?.role).toBe("admin");

    const me = await client.get("/api/auth/me");
    expect(me.status).toBe(200);
    expect(await me.json()).toEqual({ email: "first@justif.test", role: "admin" });
  });

  it("refuses to set up a second account once one already exists", async () => {
    await createUser({ email: "existing@justif.test" });
    const client = new TestClient(server.baseUrl);
    const res = await client.post("/api/auth/setup", {
      email: "second@justif.test",
      password: "supersecret",
    });
    expect(res.status).toBe(403);
  });

  it("rejects a password shorter than 8 characters", async () => {
    const client = new TestClient(server.baseUrl);
    const res = await client.post("/api/auth/setup", {
      email: "weak@justif.test",
      password: "short",
    });
    expect(res.status).toBe(400);
  });
});

describe("POST /api/auth/login", () => {
  it("logs in with valid credentials and allows access to /me", async () => {
    await createUser({ email: "user@justif.test" });
    const client = new TestClient(server.baseUrl);

    const login = await client.post("/api/auth/login", {
      email: "user@justif.test",
      password: DEFAULT_PASSWORD,
    });
    expect(login.status).toBe(200);

    const me = await client.get("/api/auth/me");
    expect(await me.json()).toEqual({ email: "user@justif.test", role: "user" });
  });

  it("rejects an incorrect password", async () => {
    await createUser({ email: "user2@justif.test" });
    const client = new TestClient(server.baseUrl);
    const res = await client.post("/api/auth/login", {
      email: "user2@justif.test",
      password: "wrongpassword",
    });
    expect(res.status).toBe(401);
  });

  it("rejects a deactivated account", async () => {
    await createUser({ email: "inactive@justif.test", active: false });
    const client = new TestClient(server.baseUrl);
    const res = await client.post("/api/auth/login", {
      email: "inactive@justif.test",
      password: DEFAULT_PASSWORD,
    });
    expect(res.status).toBe(403);
  });
});

describe("GET /api/auth/me", () => {
  it("rejects requests without a session cookie", async () => {
    const client = new TestClient(server.baseUrl);
    const res = await client.get("/api/auth/me");
    expect(res.status).toBe(401);
  });
});

describe("POST /api/auth/logout", () => {
  it("clears the session so /me becomes unauthorized again", async () => {
    await createUser({ email: "logout@justif.test" });
    const client = new TestClient(server.baseUrl);
    await client.post("/api/auth/login", {
      email: "logout@justif.test",
      password: DEFAULT_PASSWORD,
    });

    const logout = await client.post("/api/auth/logout");
    expect(logout.status).toBe(204);
  });
});
