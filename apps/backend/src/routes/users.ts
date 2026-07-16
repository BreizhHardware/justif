import { Router } from "express";
import bcrypt from "bcrypt";
import { prisma } from "../lib/prisma.js";
import { requirePermission } from "../middleware/auth.js";
import { SEED_ROLE_NAMES } from "../lib/permissions.js";
import { audit, ipFromReq } from "../services/auditService.js";

const router = Router();

router.use(requirePermission("MANAGE_USERS"));

function toUserResponse(user: {
  id: string;
  email: string;
  active: boolean;
  createdAt: Date;
  roles: { role: { id: string; name: string } }[];
}) {
  return {
    id: user.id,
    email: user.email,
    active: user.active,
    createdAt: user.createdAt,
    roles: user.roles.map((r) => r.role),
  };
}

async function validateRoleIds(roleIds: string[]): Promise<string | null> {
  const found = await prisma.role.findMany({ where: { id: { in: roleIds } } });
  if (found.length !== new Set(roleIds).size) {
    const foundIds = new Set(found.map((r) => r.id));
    const missing = roleIds.filter((id) => !foundIds.has(id));
    return `Invalid role id(s): ${missing.join(", ")}`;
  }
  return null;
}

router.get("/", async (_req, res) => {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    include: { roles: { select: { role: { select: { id: true, name: true } } } } },
  });
  res.json(users.map(toUserResponse));
});

router.post("/", async (req, res) => {
  const { email, password, roleIds } = req.body as {
    email?: string;
    password?: string;
    roleIds?: string[];
  };
  if (!email || !password || password.length < 8) {
    res.status(400).json({ error: "Email and password (min. 8 characters) required" });
    return;
  }
  if (roleIds !== undefined) {
    const error = await validateRoleIds(roleIds);
    if (error) {
      res.status(400).json({ error });
      return;
    }
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    res.status(409).json({ error: "An account with this email already exists" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  let targetRoleIds = roleIds;
  if (targetRoleIds === undefined) {
    const userRole = await prisma.role.findUniqueOrThrow({ where: { name: SEED_ROLE_NAMES.USER } });
    targetRoleIds = [userRole.id];
  }

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({ data: { email, passwordHash } });
    await tx.userRole.createMany({
      data: targetRoleIds.map((roleId) => ({ userId: created.id, roleId })),
    });
    return tx.user.findUniqueOrThrow({
      where: { id: created.id },
      include: { roles: { select: { role: { select: { id: true, name: true } } } } },
    });
  });

  await audit({
    userId: req.user!.id,
    action: "user.create",
    entityType: "User",
    entityId: user.id,
    metadata: { email: user.email, roles: user.roles.map((r) => r.role.name) },
    ip: ipFromReq(req),
  });
  res.status(201).json(toUserResponse(user));
});

router.patch("/:id", async (req, res) => {
  const { roleIds, active, password } = req.body as {
    roleIds?: string[];
    active?: boolean;
    password?: string;
  };

  if (roleIds !== undefined) {
    const error = await validateRoleIds(roleIds);
    if (error) {
      res.status(400).json({ error });
      return;
    }
  }

  if (req.params.id === req.user!.id) {
    if (active === false) {
      res.status(400).json({ error: "You cannot demote or disable your own account" });
      return;
    }
    if (roleIds !== undefined) {
      const grantsManageUsers =
        roleIds.length > 0 &&
        (await prisma.rolePermission.count({
          where: { roleId: { in: roleIds }, permission: "MANAGE_USERS" },
        })) > 0;
      if (!grantsManageUsers) {
        res.status(400).json({ error: "You cannot remove your own user-management access" });
        return;
      }
    }
  }

  const data: { active?: boolean; passwordHash?: string } = {};
  if (active !== undefined) data.active = active;
  if (password) {
    if (password.length < 8) {
      res.status(400).json({ error: "Password too short (min. 8 characters)" });
      return;
    }
    data.passwordHash = await bcrypt.hash(password, 12);
  }

  const user = await prisma.$transaction(async (tx) => {
    if (Object.keys(data).length > 0) {
      await tx.user.update({ where: { id: req.params.id }, data });
    }
    if (roleIds !== undefined) {
      await tx.userRole.deleteMany({ where: { userId: req.params.id } });
      if (roleIds.length > 0) {
        await tx.userRole.createMany({
          data: roleIds.map((roleId) => ({ userId: req.params.id, roleId })),
        });
      }
    }
    return tx.user.findUniqueOrThrow({
      where: { id: req.params.id },
      include: { roles: { select: { role: { select: { id: true, name: true } } } } },
    });
  });

  const changes: Record<string, unknown> = {};
  if (roleIds !== undefined) changes.roles = user.roles.map((r) => r.role.name);
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
  res.json(toUserResponse(user));
});

export default router;
