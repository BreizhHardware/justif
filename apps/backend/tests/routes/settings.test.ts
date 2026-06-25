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

async function loginAs(opts: { email: string; role?: "admin" | "user" }) {
  await createUser(opts);
  const client = new TestClient(server.baseUrl);
  await client.post("/api/auth/login", { email: opts.email, password: DEFAULT_PASSWORD });
  return client;
}

describe("/api/settings admin guard", () => {
  it("rejects a non-admin user", async () => {
    const client = await loginAs({ email: "plain@justif.test", role: "user" });
    const res = await client.get("/api/settings");
    expect(res.status).toBe(403);
  });

  it("rejects an unauthenticated request", async () => {
    const client = new TestClient(server.baseUrl);
    const res = await client.get("/api/settings");
    expect(res.status).toBe(401);
  });
});

describe("GET /api/settings", () => {
  it("returns defaults and never leaks the Mistral API key value", async () => {
    const admin = await loginAs({ email: "admin@justif.test", role: "admin" });
    const res = await admin.get("/api/settings");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.default_currency).toBe("EUR");
    expect(body.mistral_api_key).toBeUndefined();
    expect(body.mistral_api_key_set).toBeDefined();
  });
});

describe("PATCH /api/settings", () => {
  it("updates public settings and ignores unknown keys", async () => {
    const admin = await loginAs({ email: "admin2@justif.test", role: "admin" });

    const res = await admin.patch("/api/settings", {
      default_currency: "USD",
      not_a_real_key: "x",
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.default_currency).toBe("USD");
    expect(body.not_a_real_key).toBeUndefined();

    const after = await admin.get("/api/settings");
    expect((await after.json()).default_currency).toBe("USD");
  });
});
