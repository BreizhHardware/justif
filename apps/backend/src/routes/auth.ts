import { Router } from "express";
import bcrypt from "bcrypt";
import { prisma } from "../lib/prisma.js";
import { requireAuth, signToken } from "../middleware/auth.js";
import { audit, ipFromReq } from "../services/auditService.js";
import { SEED_ROLE_NAMES } from "../lib/permissions.js";

const router = Router();
const COOKIE_OPTS = { httpOnly: true, sameSite: "lax" as const, maxAge: 30 * 24 * 60 * 60 * 1000 };

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
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
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
    res.json({ setupComplete: Boolean(existing) });
  } catch {
    res.json({ setupComplete: false });
  }
});

export default router;
