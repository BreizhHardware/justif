import { Router } from "express";
import bcrypt from "bcrypt";
import { prisma } from "../lib/prisma.js";
import { requireAdmin } from "../middleware/auth.js";
import { audit, ipFromReq } from "../services/auditService.js";

const router = Router();

router.use(requireAdmin);

router.get("/", async (_req, res) => {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, email: true, role: true, active: true, createdAt: true },
  });
  res.json(users);
});

router.post("/", async (req, res) => {
  const { email, password, role } = req.body as {
    email?: string;
    password?: string;
    role?: string;
  };
  if (!email || !password || password.length < 8) {
    res.status(400).json({ error: "Email and password (min. 8 characters) required" });
    return;
  }
  if (role && role !== "admin" && role !== "user") {
    res.status(400).json({ error: "Invalid role" });
    return;
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    res.status(409).json({ error: "An account with this email already exists" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { email, passwordHash, role: role ?? "user" },
    select: { id: true, email: true, role: true, active: true, createdAt: true },
  });
  await audit({
    userId: req.user!.id,
    action: "user.create",
    entityType: "User",
    entityId: user.id,
    metadata: { email: user.email, role: user.role },
    ip: ipFromReq(req),
  });
  res.status(201).json(user);
});

router.patch("/:id", async (req, res) => {
  const { role, active, password } = req.body as {
    role?: string;
    active?: boolean;
    password?: string;
  };

  if (role && role !== "admin" && role !== "user") {
    res.status(400).json({ error: "Invalid role" });
    return;
  }

  if (req.params.id === req.user!.id && (role === "user" || active === false)) {
    res.status(400).json({ error: "You cannot demote or disable your own account" });
    return;
  }

  const data: { role?: string; active?: boolean; passwordHash?: string } = {};
  if (role) data.role = role;
  if (active !== undefined) data.active = active;
  if (password) {
    if (password.length < 8) {
      res.status(400).json({ error: "Password too short (min. 8 characters)" });
      return;
    }
    data.passwordHash = await bcrypt.hash(password, 12);
  }

  const user = await prisma.user.update({
    where: { id: req.params.id },
    data,
    select: { id: true, email: true, role: true, active: true, createdAt: true },
  });
  const changes: Record<string, unknown> = {};
  if (role) changes.role = role;
  if (active !== undefined) changes.active = active;
  if (password) changes.passwordChanged = true;
  await audit({
    userId: req.user!.id,
    action: "user.update",
    entityType: "User",
    entityId: user.id,
    metadata: { changes },
    ip: ipFromReq(req),
  });
  res.json(user);
});

export default router;
