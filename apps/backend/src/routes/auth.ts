import { Router } from "express";
import bcrypt from "bcrypt";
import { prisma } from "../lib/prisma.js";
import { requireAuth, signToken } from "../middleware/auth.js";

const router = Router();
const COOKIE_OPTS = { httpOnly: true, sameSite: "lax" as const, maxAge: 30 * 24 * 60 * 60 * 1000 };

router.post("/setup", async (req, res) => {
  const existing = await prisma.user.findFirst();
  if (existing) {
    res.status(403).json({ error: "Un compte existe déjà" });
    return;
  }

  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password || password.length < 8) {
    res.status(400).json({ error: "Email et mot de passe (8 caractères min.) requis" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({ data: { email, passwordHash } });

  const token = signToken(user.id, user.email);
  res.cookie("token", token, COOKIE_OPTS);
  res.json({ token });
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) {
    res.status(400).json({ error: "Email et mot de passe requis" });
    return;
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    res.status(401).json({ error: "Identifiants invalides" });
    return;
  }

  const token = signToken(user.id, user.email);
  res.cookie("token", token, COOKIE_OPTS);
  res.json({ token });
});

router.post("/logout", (_req, res) => {
  res.clearCookie("token");
  res.status(204).end();
});

router.get("/me", requireAuth, (req, res) => {
  res.json({ email: req.user!.email });
});

router.get("/status", async (_req, res) => {
  const existing = await prisma.user.findFirst();
  res.json({ setupComplete: Boolean(existing) });
});

export default router;
