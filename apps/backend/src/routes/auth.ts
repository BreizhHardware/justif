import { Router, type Response } from "express";
import bcrypt from "bcrypt";
import * as client from "openid-client";
import { prisma } from "../lib/prisma.js";
import { requireAuth, signToken } from "../middleware/auth.js";
import { audit, ipFromReq } from "../services/auditService.js";
import { SEED_ROLE_NAMES } from "../lib/permissions.js";
import { getAppUrl } from "../lib/appUrl.js";
import {
  createPasswordResetToken,
  consumePasswordResetToken,
} from "../services/passwordResetService.js";
import { sendPasswordResetEmail } from "../services/emailService.js";
import { discoverOidcClient, getOidcSettings } from "../services/oidcService.js";

const router = Router();
const COOKIE_OPTS = { httpOnly: true, sameSite: "lax" as const, maxAge: 30 * 24 * 60 * 60 * 1000 };
// Short-lived cookie holding the PKCE verifier, state and nonce of an in-flight
// OIDC login, scoped to the /oidc routes only. Not a session credential.
const OIDC_FLOW_COOKIE = "oidc_flow";
const OIDC_FLOW_COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "lax" as const,
  maxAge: 10 * 60 * 1000,
  path: "/api/auth/oidc",
};

function oidcCallbackUrl(): string {
  return `${getAppUrl()}/api/auth/oidc/callback`;
}

function redirectToLoginWithError(res: Response, code: string) {
  res.redirect(`${getAppUrl()}/login?error=${encodeURIComponent(code)}`);
}

router.post("/setup", async (req, res) => {
  const existing = await prisma.user.findFirst();
  if (existing) {
    res.status(403).json({ error: "An account already exists" });
    return;
  }

  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password || password.length < 8) {
    res.status(400).json({ error: "Email and password (min. 8 characters) required" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: SEED_ROLE_NAMES.ADMIN } });
  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({ data: { email, passwordHash } });
    await tx.userRole.create({ data: { userId: created.id, roleId: adminRole.id } });
    return created;
  });

  const token = signToken(user.id);
  res.cookie("token", token, COOKIE_OPTS);
  res.json({ token });
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) {
    res.status(400).json({ error: "Email and password required" });
    return;
  }

  const ip = ipFromReq(req);
  const user = await prisma.user.findUnique({ where: { email } });
  // Accounts provisioned exclusively via OIDC have no local password to check.
  if (!user || !user.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
    await audit({ action: "auth.login_failed", metadata: { reason: "invalid_credentials" }, ip });
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }
  if (!user.active) {
    await audit({
      userId: user.id,
      action: "auth.login_failed",
      metadata: { reason: "account_disabled" },
      ip,
    });
    res.status(403).json({ error: "This account has been disabled" });
    return;
  }

  const token = signToken(user.id);
  res.cookie("token", token, COOKIE_OPTS);
  await audit({ userId: user.id, action: "auth.login", ip });
  res.json({ token });
});

router.post("/forgot-password", async (req, res) => {
  const { email } = req.body as { email?: string };
  if (!email) {
    res.status(400).json({ error: "Email required" });
    return;
  }

  // Always return the same generic response, whether or not the account
  // exists, so this endpoint can't be used to enumerate registered emails.
  const genericResponse = {
    message: "If an account exists for this email, a reset link has been sent.",
  };

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.active) {
    res.json(genericResponse);
    return;
  }

  const rawToken = await createPasswordResetToken(user.id);
  try {
    const resetUrl = `${getAppUrl()}/reset-password?token=${rawToken}`;
    await sendPasswordResetEmail(user.email, resetUrl);
  } catch (err) {
    console.error("Failed to send password reset email:", err);
  }
  await audit({ userId: user.id, action: "auth.password_reset_requested", ip: ipFromReq(req) });

  res.json(genericResponse);
});

router.post("/reset-password", async (req, res) => {
  const { token, password } = req.body as { token?: string; password?: string };
  if (!token || !password || password.length < 8) {
    res.status(400).json({ error: "Token and password (min. 8 characters) required" });
    return;
  }

  const userId = await consumePasswordResetToken(token);
  if (!userId) {
    res.status(400).json({ error: "This reset link is invalid or has expired" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
  await audit({ userId, action: "auth.password_reset_completed", ip: ipFromReq(req) });

  if (!user.active) {
    res.json({ message: "Password updated" });
    return;
  }

  const jwt = signToken(user.id);
  res.cookie("token", jwt, COOKIE_OPTS);
  res.json({ token: jwt });
});

router.post("/logout", (_req, res) => {
  res.clearCookie("token");
  res.status(204).end();
});

router.get("/me", requireAuth, (req, res) => {
  res.json({
    email: req.user!.email,
    theme: req.user!.theme,
    dashboardBreakdownBy: req.user!.dashboardBreakdownBy,
    dashboardGranularity: req.user!.dashboardGranularity,
    roles: req.user!.roles,
    permissions: req.user!.permissions,
  });
});

router.patch("/me", requireAuth, async (req, res) => {
  const { theme, dashboardBreakdownBy, dashboardGranularity } = req.body as {
    theme?: string;
    dashboardBreakdownBy?: string;
    dashboardGranularity?: string;
  };

  const data: {
    theme?: string;
    dashboardBreakdownBy?: string;
    dashboardGranularity?: string;
  } = {};

  if (theme !== undefined) {
    if (!["light", "dark", "system"].includes(theme)) {
      res.status(400).json({ error: "Invalid theme value" });
      return;
    }
    data.theme = theme;
  }

  if (dashboardBreakdownBy !== undefined) {
    if (!["category", "vendor"].includes(dashboardBreakdownBy)) {
      res.status(400).json({ error: "Invalid dashboardBreakdownBy value" });
      return;
    }
    data.dashboardBreakdownBy = dashboardBreakdownBy;
  }

  if (dashboardGranularity !== undefined) {
    if (!["month", "day"].includes(dashboardGranularity)) {
      res.status(400).json({ error: "Invalid dashboardGranularity value" });
      return;
    }
    data.dashboardGranularity = dashboardGranularity;
  }

  if (Object.keys(data).length === 0) {
    res.status(400).json({ error: "No valid fields to update" });
    return;
  }

  await prisma.user.update({ where: { id: req.user!.id }, data });
  res.json(data);
});

router.get("/status", async (_req, res) => {
  try {
    const existing = await prisma.user.findFirst();
    const oidcSettings = await getOidcSettings();
    res.json({ setupComplete: Boolean(existing), oidcEnabled: oidcSettings !== null });
  } catch {
    res.json({ setupComplete: false, oidcEnabled: false });
  }
});

router.get("/oidc/login", async (_req, res) => {
  let discovered;
  try {
    discovered = await discoverOidcClient();
  } catch (err) {
    console.error("OIDC discovery failed:", err);
    redirectToLoginWithError(res, "oidc_unavailable");
    return;
  }
  if (!discovered) {
    redirectToLoginWithError(res, "oidc_unavailable");
    return;
  }
  const { config, settings } = discovered;

  const codeVerifier = client.randomPKCECodeVerifier();
  const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier);
  const state = client.randomState();
  const nonce = client.randomNonce();

  const authorizationUrl = client.buildAuthorizationUrl(config, {
    redirect_uri: oidcCallbackUrl(),
    scope: settings.scopes,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    state,
    nonce,
  });

  res.cookie(
    OIDC_FLOW_COOKIE,
    JSON.stringify({ state, nonce, codeVerifier }),
    OIDC_FLOW_COOKIE_OPTS,
  );
  res.redirect(authorizationUrl.href);
});

router.get("/oidc/callback", async (req, res) => {
  const ip = ipFromReq(req);
  const flowCookie = req.cookies?.[OIDC_FLOW_COOKIE] as string | undefined;
  res.clearCookie(OIDC_FLOW_COOKIE, { path: "/api/auth/oidc" });

  let flow: { state: string; nonce: string; codeVerifier: string };
  try {
    if (!flowCookie) throw new Error("missing flow cookie");
    flow = JSON.parse(flowCookie);
  } catch {
    redirectToLoginWithError(res, "oidc_invalid_session");
    return;
  }

  let discovered;
  try {
    discovered = await discoverOidcClient();
  } catch (err) {
    console.error("OIDC discovery failed:", err);
    discovered = null;
  }
  if (!discovered) {
    redirectToLoginWithError(res, "oidc_unavailable");
    return;
  }
  const { config, settings } = discovered;

  let tokens;
  try {
    const currentUrl = new URL(oidcCallbackUrl());
    currentUrl.search = new URL(req.originalUrl, currentUrl).search;
    tokens = await client.authorizationCodeGrant(config, currentUrl, {
      pkceCodeVerifier: flow.codeVerifier,
      expectedState: flow.state,
      expectedNonce: flow.nonce,
    });
  } catch (err) {
    console.error("OIDC token exchange failed:", err);
    await audit({
      action: "auth.oidc_login_failed",
      metadata: { reason: "token_exchange_failed" },
      ip,
    });
    redirectToLoginWithError(res, "oidc_failed");
    return;
  }

  const claims = tokens.claims();
  const subject = claims?.sub;
  const issuer = typeof claims?.iss === "string" ? claims.iss : undefined;
  const email = typeof claims?.email === "string" ? claims.email : undefined;
  if (!subject || !issuer || !email) {
    await audit({ action: "auth.oidc_login_failed", metadata: { reason: "no_email_claim" }, ip });
    redirectToLoginWithError(res, "oidc_no_email");
    return;
  }

  // Groups claim: prefer the ID token, fall back to the userinfo endpoint
  // (some providers - e.g. Azure/Entra ID - only populate it there).
  let groups: string[] = [];
  const claimGroups = claims[settings.groupsClaim];
  if (Array.isArray(claimGroups)) {
    groups = claimGroups.filter((g): g is string => typeof g === "string");
  } else if (tokens.access_token) {
    try {
      const userinfo = await client.fetchUserInfo(config, tokens.access_token, subject);
      const uiGroups = (userinfo as Record<string, unknown>)[settings.groupsClaim];
      if (Array.isArray(uiGroups))
        groups = uiGroups.filter((g): g is string => typeof g === "string");
    } catch {
      // Groups claim is optional - if userinfo fails, mapping simply won't apply.
    }
  }

  // Only proceed when the IdP doesn't explicitly say the email is
  // unverified - an unverified email can't be trusted to prove ownership of
  // a pre-existing password account, nor to identify a brand-new account.
  if (claims.email_verified === false) {
    await audit({
      action: "auth.oidc_login_failed",
      metadata: { reason: "unverified_email", email },
      ip,
    });
    redirectToLoginWithError(res, "oidc_unverified_email");
    return;
  }

  let user = await prisma.user.findUnique({
    where: { oidcIdentity: { oidcIssuer: issuer, oidcSubject: subject } },
  });
  let linked = false;
  if (!user) {
    const existingByEmail = await prisma.user.findUnique({ where: { email } });
    if (existingByEmail) {
      user = await prisma.user.update({
        where: { id: existingByEmail.id },
        data: { oidcIssuer: issuer, oidcSubject: subject },
      });
      linked = true;
    }
  }

  if (!user) {
    const userRole = await prisma.role.findUnique({ where: { name: SEED_ROLE_NAMES.USER } });
    user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: { email, oidcIssuer: issuer, oidcSubject: subject, passwordHash: null, active: true },
      });
      if (userRole) {
        await tx.userRole.create({ data: { userId: created.id, roleId: userRole.id } });
      }
      return created;
    });
  }

  if (!user.active) {
    await audit({
      userId: user.id,
      action: "auth.oidc_login_failed",
      metadata: { reason: "account_disabled" },
      ip,
    });
    redirectToLoginWithError(res, "oidc_disabled");
    return;
  }

  // Group -> role sync: only touch role assignment when the admin has
  // configured at least one mapping that matches, so instances not using
  // this feature keep their manually-assigned roles untouched.
  if (groups.length > 0) {
    const mappings = await prisma.roleOidcGroup.findMany({ where: { groupName: { in: groups } } });
    if (mappings.length > 0) {
      const roleIds = [...new Set(mappings.map((m) => m.roleId))];
      await prisma.$transaction([
        prisma.userRole.deleteMany({ where: { userId: user.id } }),
        prisma.userRole.createMany({
          data: roleIds.map((roleId) => ({ userId: user.id, roleId })),
        }),
      ]);
    }
  }

  if (linked) {
    await audit({ userId: user.id, action: "auth.oidc_account_linked", metadata: { email }, ip });
  }
  await audit({ userId: user.id, action: "auth.oidc_login", ip });

  const token = signToken(user.id);
  res.cookie("token", token, COOKIE_OPTS);
  res.redirect(`${getAppUrl()}/dashboard`);
});

export default router;
