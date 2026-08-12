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

async function loginAs(opts: { email: string; roleNames?: string[] }) {
  await createUser(opts);
  const client = new TestClient(server.baseUrl);
  await client.post("/api/auth/login", { email: opts.email, password: DEFAULT_PASSWORD });
  return client;
}

describe("/api/settings admin guard", () => {
  it("rejects a non-admin user", async () => {
    const client = await loginAs({ email: "plain@justif.test", roleNames: ["User"] });
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
    const admin = await loginAs({ email: "admin@justif.test", roleNames: ["Admin"] });
    const res = await admin.get("/api/settings");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.default_currency).toBe("EUR");
    expect(body.ocr_prompt_override).toBe("");
    expect(body.ocr_extract_reference_number).toBe("false");
    expect(body.mistral_api_key).toBeUndefined();
    expect(body.mistral_api_key_set).toBeDefined();
  });
});

describe("PATCH /api/settings", () => {
  it("updates public settings and ignores unknown keys", async () => {
    const admin = await loginAs({ email: "admin2@justif.test", roleNames: ["Admin"] });

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

  it("round-trips the OCR prompt override", async () => {
    const admin = await loginAs({ email: "admin3@justif.test", roleNames: ["Admin"] });

    const res = await admin.patch("/api/settings", {
      ocr_prompt_override: "Always flag reference numbers circled in red.",
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ocr_prompt_override).toBe("Always flag reference numbers circled in red.");
  });

  it("round-trips the reference-number extraction toggle", async () => {
    const admin = await loginAs({ email: "admin4@justif.test", roleNames: ["Admin"] });

    const res = await admin.patch("/api/settings", { ocr_extract_reference_number: "true" });
    expect(res.status).toBe(200);
    expect((await res.json()).ocr_extract_reference_number).toBe("true");
  });

  it("round-trips the SMTP settings and never leaks the password value", async () => {
    const admin = await loginAs({ email: "admin5@justif.test", roleNames: ["Admin"] });

    const res = await admin.patch("/api/settings", {
      smtp_host: "smtp.example.com",
      smtp_port: "2525",
      smtp_secure: "true",
      smtp_user: "no-reply@example.com",
      smtp_from: "Justif <no-reply@example.com>",
      smtp_password: "super-secret",
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.smtp_host).toBe("smtp.example.com");
    expect(body.smtp_port).toBe("2525");
    expect(body.smtp_secure).toBe("true");
    expect(body.smtp_from).toBe("Justif <no-reply@example.com>");
    expect(body.smtp_password).toBeUndefined();

    const after = await admin.get("/api/settings");
    const afterBody = await after.json();
    expect(afterBody.smtp_password).toBeUndefined();
    expect(afterBody.smtp_password_set).toBe("true");
  });
});

describe("POST /api/settings/test-email", () => {
  it("returns success:false without throwing when SMTP is not configured", async () => {
    const admin = await loginAs({ email: "admin6@justif.test", roleNames: ["Admin"] });
    const res = await admin.post("/api/settings/test-email");
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  it("rejects a non-admin user", async () => {
    const client = await loginAs({ email: "plain2@justif.test", roleNames: ["User"] });
    const res = await client.post("/api/settings/test-email");
    expect(res.status).toBe(403);
  });
});
