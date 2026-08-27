import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { startTestServer, TestClient, type TestServer } from "../client.js";
import { createUser, DEFAULT_PASSWORD, getRoleIdByName } from "../fixtures.js";
import { prisma } from "../../src/lib/prisma.js";

const FAKE_SETTINGS = {
  issuerUrl: "https://idp.example.test",
  clientId: "justif",
  clientSecret: "secret",
  scopes: "openid email profile",
  groupsClaim: "groups",
};

const { discoverOidcClient } = vi.hoisted(() => ({ discoverOidcClient: vi.fn() }));
vi.mock("../../src/services/oidcService.js", () => ({
  discoverOidcClient,
  getOidcSettings: vi.fn(),
}));

const { authorizationCodeGrant } = vi.hoisted(() => ({ authorizationCodeGrant: vi.fn() }));
vi.mock("openid-client", () => ({
  randomPKCECodeVerifier: () => "verifier",
  calculatePKCECodeChallenge: async () => "challenge",
  randomState: () => "fake-state",
  randomNonce: () => "fake-nonce",
  buildAuthorizationUrl: (_config: unknown, params: Record<string, string>) =>
    new URL(`https://idp.example.test/authorize?state=${params.state}`),
  authorizationCodeGrant,
  fetchUserInfo: async () => ({}),
}));

function fakeTokens(claims: Record<string, unknown>) {
  return { access_token: "at", claims: () => ({ iss: FAKE_SETTINGS.issuerUrl, ...claims }) };
}

let server: TestServer;

beforeAll(async () => {
  server = await startTestServer();
});

afterAll(async () => {
  await server.close();
  vi.restoreAllMocks();
});

beforeEach(() => {
  discoverOidcClient.mockReset();
  authorizationCodeGrant.mockReset();
});

async function startFlow(): Promise<TestClient> {
  discoverOidcClient.mockResolvedValue({ config: {}, settings: FAKE_SETTINGS });
  const testClient = new TestClient(server.baseUrl);
  const login = await testClient.request("/api/auth/oidc/login", { redirect: "manual" });
  expect(login.status).toBe(302);
  expect(login.headers.get("location")).toContain("https://idp.example.test/authorize");
  return testClient;
}

async function callback(testClient: TestClient) {
  return testClient.request("/api/auth/oidc/callback?code=abc&state=fake-state", {
    redirect: "manual",
  });
}

describe("GET /api/auth/oidc/login", () => {
  it("redirects to the login page with an error when SSO isn't configured", async () => {
    discoverOidcClient.mockResolvedValue(null);
    const testClient = new TestClient(server.baseUrl);
    const res = await testClient.request("/api/auth/oidc/login", { redirect: "manual" });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("/login?error=oidc_unavailable");
  });
});

describe("GET /api/auth/oidc/callback", () => {
  it("redirects with an error when the flow cookie is missing", async () => {
    const testClient = new TestClient(server.baseUrl);
    const res = await callback(testClient);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("/login?error=oidc_invalid_session");
  });

  it("provisions a new account on first login and syncs the session", async () => {
    const testClient = await startFlow();
    authorizationCodeGrant.mockResolvedValue(
      fakeTokens({ sub: "sub-1", email: "new@justif.test", email_verified: true }),
    );

    const res = await callback(testClient);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("/dashboard");

    const user = await prisma.user.findUnique({
      where: { email: "new@justif.test" },
      include: { roles: { include: { role: true } } },
    });
    expect(user?.oidcSubject).toBe("sub-1");
    expect(user?.oidcIssuer).toBe(FAKE_SETTINGS.issuerUrl);
    expect(user?.passwordHash).toBeNull();
    expect(user?.roles.map((r) => r.role.name)).toEqual(["User"]);

    const me = await testClient.get("/api/auth/me");
    expect(me.status).toBe(200);
    expect((await me.json()).email).toBe("new@justif.test");
  });

  it("does not confuse two accounts sharing the same subject from different issuers", async () => {
    // Same `sub` value, but scoped to a different issuer than FAKE_SETTINGS -
    // the OIDC spec only guarantees `sub` uniqueness within a single issuer.
    await prisma.user.create({
      data: {
        email: "other-issuer@justif.test",
        oidcIssuer: "https://other-idp.example.test",
        oidcSubject: "shared-sub",
        active: true,
      },
    });

    const testClient = await startFlow();
    authorizationCodeGrant.mockResolvedValue(
      fakeTokens({ sub: "shared-sub", email: "new-issuer@justif.test", email_verified: true }),
    );

    const res = await callback(testClient);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("/dashboard");

    // A distinct account was provisioned rather than reusing the other issuer's user.
    const newUser = await prisma.user.findUnique({ where: { email: "new-issuer@justif.test" } });
    expect(newUser?.oidcIssuer).toBe(FAKE_SETTINGS.issuerUrl);
    expect(newUser?.oidcSubject).toBe("shared-sub");

    const otherUser = await prisma.user.findUnique({
      where: { email: "other-issuer@justif.test" },
    });
    expect(otherUser?.oidcIssuer).toBe("https://other-idp.example.test");
  });

  it("links an existing password account with a matching verified email, keeping the password usable", async () => {
    const existing = await createUser({ email: "shared@justif.test" });
    const testClient = await startFlow();
    authorizationCodeGrant.mockResolvedValue(
      fakeTokens({ sub: "sub-2", email: "shared@justif.test", email_verified: true }),
    );

    const res = await callback(testClient);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("/dashboard");

    const linked = await prisma.user.findUnique({ where: { id: existing.id } });
    expect(linked?.oidcSubject).toBe("sub-2");
    expect(linked?.passwordHash).not.toBeNull();

    const passwordLogin = new TestClient(server.baseUrl);
    const loginRes = await passwordLogin.post("/api/auth/login", {
      email: "shared@justif.test",
      password: DEFAULT_PASSWORD,
    });
    expect(loginRes.status).toBe(200);
  });

  it("refuses to link when the identity provider says the email is unverified", async () => {
    const existing = await createUser({ email: "unverified@justif.test" });
    const testClient = await startFlow();
    authorizationCodeGrant.mockResolvedValue(
      fakeTokens({ sub: "sub-3", email: "unverified@justif.test", email_verified: false }),
    );

    const res = await callback(testClient);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("/login?error=oidc_unverified_email");

    const untouched = await prisma.user.findUnique({ where: { id: existing.id } });
    expect(untouched?.oidcSubject).toBeNull();
  });

  it("rejects login for a disabled account", async () => {
    await createUser({ email: "disabled@justif.test", active: false });
    const testClient = await startFlow();
    authorizationCodeGrant.mockResolvedValue(
      fakeTokens({ sub: "sub-4", email: "disabled@justif.test", email_verified: true }),
    );

    const res = await callback(testClient);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("/login?error=oidc_disabled");
  });

  it("assigns roles mapped from the groups claim instead of the default role", async () => {
    const adminRoleId = await getRoleIdByName("Admin");
    await prisma.roleOidcGroup.create({
      data: { roleId: adminRoleId, groupName: "Finance-Admins" },
    });

    const testClient = await startFlow();
    authorizationCodeGrant.mockResolvedValue(
      fakeTokens({
        sub: "sub-5",
        email: "mapped@justif.test",
        email_verified: true,
        groups: ["Finance-Admins"],
      }),
    );

    const res = await callback(testClient);
    expect(res.status).toBe(302);

    const user = await prisma.user.findUnique({
      where: { email: "mapped@justif.test" },
      include: { roles: { include: { role: true } } },
    });
    expect(user?.roles.map((r) => r.role.name)).toEqual(["Admin"]);
  });

  it("redirects with an error when the token exchange fails", async () => {
    const testClient = await startFlow();
    authorizationCodeGrant.mockRejectedValue(new Error("boom"));

    const res = await callback(testClient);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("/login?error=oidc_failed");
  });
});
