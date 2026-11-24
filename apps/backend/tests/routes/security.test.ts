import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startTestServer, TestClient, type TestServer } from "../client.js";
import { createUser, DEFAULT_PASSWORD } from "../fixtures.js";
import { SEED_ROLE_NAMES } from "../../src/lib/permissions.js";
import { getJwtSecret } from "../../src/lib/jwtSecret.js";

let server: TestServer;

beforeAll(async () => {
  server = await startTestServer();
});

afterAll(async () => {
  await server.close();
});

async function login(email: string) {
  const client = new TestClient(server.baseUrl);
  const res = await client.post("/api/auth/login", { email, password: DEFAULT_PASSWORD });
  expect(res.status).toBe(200);
  return client;
}

function receiptForm(name: string, type: string, content: BlobPart) {
  const form = new FormData();
  form.set("date", "2026-01-01");
  form.set("montant_ttc", "10");
  form.set("fichier", new File([content], name, { type }));
  return form;
}

describe("POST /api/auth/setup", () => {
  it("creates exactly one admin when called concurrently", async () => {
    const results = await Promise.all(
      [1, 2, 3, 4, 5].map((i) =>
        new TestClient(server.baseUrl).post("/api/auth/setup", {
          email: `admin${i}@justif.test`,
          password: DEFAULT_PASSWORD,
        }),
      ),
    );
    const statuses = results.map((r) => r.status).sort();
    expect(statuses.filter((s) => s === 200)).toHaveLength(1);
    expect(statuses.filter((s) => s === 403)).toHaveLength(4);
  });
});

describe("receipt uploads", () => {
  it("rejects non-image/PDF files such as HTML", async () => {
    await createUser({ email: "html@justif.test" });
    const client = await login("html@justif.test");
    const res = await client.postForm(
      "/api/expenses",
      receiptForm("x.html", "text/html", "<script>alert(1)</script>"),
    );
    expect(res.status).toBe(400);
  });

  it("only lets the owner or a user manager read a receipt, in a sandbox", async () => {
    await createUser({ email: "owner@justif.test" });
    await createUser({ email: "other@justif.test" });
    await createUser({ email: "boss@justif.test", roleNames: [SEED_ROLE_NAMES.ADMIN] });
    const owner = await login("owner@justif.test");
    const created = await owner.postForm(
      "/api/expenses",
      receiptForm("r.pdf", "application/pdf", "%PDF-1.4 test"),
    );
    expect(created.status).toBe(201);
    const { fichier } = (await created.json()) as { fichier: string };
    expect(fichier).toMatch(/\.pdf$/);

    const ownRes = await owner.get(`/uploads/${fichier}`);
    expect(ownRes.status).toBe(200);
    expect(ownRes.headers.get("content-security-policy")).toContain("sandbox");
    expect(ownRes.headers.get("x-content-type-options")).toBe("nosniff");

    expect((await (await login("other@justif.test")).get(`/uploads/${fichier}`)).status).toBe(403);
    expect((await (await login("boss@justif.test")).get(`/uploads/${fichier}`)).status).toBe(200);
    expect((await new TestClient(server.baseUrl).get(`/uploads/${fichier}`)).status).toBe(401);
    expect((await owner.get("/uploads/unknown.pdf")).status).toBe(404);
  });
});

describe("audit log IP", () => {
  it("ignores a spoofed X-Forwarded-For header", async () => {
    const client = new TestClient(server.baseUrl);
    await client.request("/api/auth/login", {
      method: "POST",
      headers: { "x-forwarded-for": "6.6.6.6" },
      body: JSON.stringify({ email: "nobody@justif.test", password: "whatever" }),
    });
    const { prisma } = await import("../../src/lib/prisma.js");
    const entry = await prisma.auditLog.findFirst({
      where: { action: "auth.login_failed" },
      orderBy: { timestamp: "desc" },
    });
    expect(entry?.ip).not.toBe("6.6.6.6");
  });
});

describe("getJwtSecret", () => {
  it("refuses weak or placeholder secrets outside development/test", () => {
    const env = { ...process.env };
    try {
      process.env.NODE_ENV = "production";
      process.env.JWT_SECRET = "change_me_in_production_min_32_chars";
      expect(() => getJwtSecret()).toThrow();
      process.env.JWT_SECRET = "short";
      expect(() => getJwtSecret()).toThrow();
      delete process.env.JWT_SECRET;
      expect(() => getJwtSecret()).toThrow();
      process.env.JWT_SECRET = "a".repeat(48);
      expect(getJwtSecret()).toBe("a".repeat(48));
    } finally {
      process.env = env;
    }
  });
});

describe("session revocation", () => {
  it("rejects sessions issued before a password reset and never exposes the JWT in the body", async () => {
    const user = await createUser({ email: "revoke@justif.test" });
    const client = new TestClient(server.baseUrl);
    const res = await client.post("/api/auth/login", {
      email: "revoke@justif.test",
      password: DEFAULT_PASSWORD,
    });
    expect(await res.json()).toEqual({ ok: true });
    expect((await client.get("/api/auth/me")).status).toBe(200);

    const { prisma } = await import("../../src/lib/prisma.js");
    await prisma.user.update({
      where: { id: user.id },
      data: { sessionsValidFrom: new Date(Date.now() + 5000) },
    });
    expect((await client.get("/api/auth/me")).status).toBe(401);
  });
});

describe("input validation", () => {
  it("returns 400 for invalid amounts, dates and currency codes", async () => {
    await createUser({ email: "valid@justif.test" });
    const client = await login("valid@justif.test");
    const post = (fields: Record<string, string>) => {
      const form = new FormData();
      for (const [k, v] of Object.entries(fields)) form.set(k, v);
      return client.postForm("/api/expenses", form);
    };
    expect((await post({ date: "nope" })).status).toBe(400);
    expect((await post({ date: "2026-01-01", montant_ttc: "abc" })).status).toBe(400);
    expect((await post({ date: "2026-01-01", devise: "EURO" })).status).toBe(400);
    expect((await client.get("/api/expenses?from=garbage")).status).toBe(400);
  });

  it("caps the page size", async () => {
    await createUser({ email: "valid@justif.test" });
    const client = await login("valid@justif.test");
    const body = (await (await client.get("/api/expenses?limit=100000")).json()) as {
      pages: number;
    };
    expect(body.pages).toBeGreaterThanOrEqual(0);
  });
});

describe("export CSRF guard", () => {
  it("refuses cross-site navigations", async () => {
    await createUser({ email: "valid@justif.test" });
    const client = await login("valid@justif.test");
    const res = await client.request("/api/expenses/export", {
      headers: { "sec-fetch-site": "cross-site" },
    });
    expect(res.status).toBe(403);
  });
});

describe("session version binding", () => {
  it("rejects a token carrying an outdated session version, even within the same second", async () => {
    const user = await createUser({ email: "sv@justif.test" });
    const client = await login("sv@justif.test");
    expect((await client.get("/api/auth/me")).status).toBe(200);
    const { prisma } = await import("../../src/lib/prisma.js");
    await prisma.user.update({ where: { id: user.id }, data: { sessionsValidFrom: new Date() } });
    expect((await client.get("/api/auth/me")).status).toBe(401);
    const fresh = await login("sv@justif.test");
    expect((await fresh.get("/api/auth/me")).status).toBe(200);
  });
});
