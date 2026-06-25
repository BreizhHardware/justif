import { Router } from "express";
import bcrypt from "bcrypt";
import { prisma } from "../lib/prisma.js";
import { requireAdmin } from "../middleware/auth.js";

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
    res.status(400).json({ error: "Email et mot de passe (8 caractères min.) requis" });
    return;
  }
  if (role && role !== "admin" && role !== "user") {
    res.status(400).json({ error: "Rôle invalide" });
    return;
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    res.status(409).json({ error: "Un compte avec cet email existe déjà" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { email, passwordHash, role: role ?? "user" },
    select: { id: true, email: true, role: true, active: true, createdAt: true },
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
    res.status(400).json({ error: "Rôle invalide" });
    return;
  }

  if (req.params.id === req.user!.id && (role === "user" || active === false)) {
    res.status(400).json({ error: "Vous ne pouvez pas vous rétrograder ou désactiver vous-même" });
    return;
  }

  const data: { role?: string; active?: boolean; passwordHash?: string } = {};
  if (role) data.role = role;
  if (active !== undefined) data.active = active;
  if (password) {
    if (password.length < 8) {
      res.status(400).json({ error: "Mot de passe trop court (8 caractères min.)" });
      return;
    }
    data.passwordHash = await bcrypt.hash(password, 12);
  }

  const user = await prisma.user.update({
    where: { id: req.params.id },
    data,
    select: { id: true, email: true, role: true, active: true, createdAt: true },
  });
  res.json(user);
});

export default router;
