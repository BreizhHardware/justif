import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { isValidPermission, type Permission } from "../lib/permissions.js";
import { audit, ipFromReq } from "../services/auditService.js";

const router = Router();

function toRoleResponse(role: {
  id: string;
  name: string;
  description: string | null;
  createdAt: Date;
  permissions: { permission: string }[];
  _count: { users: number };
}) {
  return {
    id: role.id,
    name: role.name,
    description: role.description,
    permissions: role.permissions.map((p) => p.permission),
    userCount: role._count.users,
    createdAt: role.createdAt,
  };
}

function invalidPermissions(permissions: unknown[]): string[] {
  return permissions.filter((p) => !isValidPermission(p)) as string[];
}

router.get("/", async (_req, res) => {
  const roles = await prisma.role.findMany({
    orderBy: { createdAt: "asc" },
    include: { permissions: true, _count: { select: { users: true } } },
  });
  res.json(roles.map(toRoleResponse));
});

router.post("/", async (req, res) => {
  const { name, description, permissions } = req.body as {
    name?: string;
    description?: string;
    permissions?: unknown[];
  };

  if (!name || !name.trim()) {
    res.status(400).json({ error: "Role name is required" });
    return;
  }
  const perms = permissions ?? [];
  const bad = invalidPermissions(perms);
  if (bad.length > 0) {
    res.status(400).json({ error: `Invalid permission(s): ${bad.join(", ")}` });
    return;
  }

  const existing = await prisma.role.findUnique({ where: { name: name.trim() } });
  if (existing) {
    res.status(409).json({ error: "A role with this name already exists" });
    return;
  }

  const role = await prisma.$transaction(async (tx) => {
    const created = await tx.role.create({
      data: { name: name.trim(), description: description ?? null },
    });
    if (perms.length > 0) {
      await tx.rolePermission.createMany({
        data: (perms as Permission[]).map((permission) => ({ roleId: created.id, permission })),
      });
    }
    return tx.role.findUniqueOrThrow({
      where: { id: created.id },
      include: { permissions: true, _count: { select: { users: true } } },
    });
  });

  await audit({
    userId: req.user!.id,
    action: "role.create",
    entityType: "Role",
    entityId: role.id,
    metadata: { name: role.name, permissions: perms },
    ip: ipFromReq(req),
  });

  res.status(201).json(toRoleResponse(role));
});

router.patch("/:id", async (req, res) => {
  const { name, description, permissions } = req.body as {
    name?: string;
    description?: string;
    permissions?: unknown[];
  };

  if (name !== undefined && !name.trim()) {
    res.status(400).json({ error: "Role name cannot be empty" });
    return;
  }
  if (permissions !== undefined) {
    const bad = invalidPermissions(permissions);
    if (bad.length > 0) {
      res.status(400).json({ error: `Invalid permission(s): ${bad.join(", ")}` });
      return;
    }
  }

  const role = await prisma.$transaction(async (tx) => {
    await tx.role.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(description !== undefined && { description }),
      },
    });
    if (permissions !== undefined) {
      await tx.rolePermission.deleteMany({ where: { roleId: req.params.id } });
      if (permissions.length > 0) {
        await tx.rolePermission.createMany({
          data: (permissions as Permission[]).map((permission) => ({
            roleId: req.params.id,
            permission,
          })),
        });
      }
    }
    return tx.role.findUniqueOrThrow({
      where: { id: req.params.id },
      include: { permissions: true, _count: { select: { users: true } } },
    });
  });

  await audit({
    userId: req.user!.id,
    action: "role.update",
    entityType: "Role",
    entityId: role.id,
    metadata: { name: role.name, permissions: permissions ?? undefined },
    ip: ipFromReq(req),
  });

  res.json(toRoleResponse(role));
});

router.delete("/:id", async (req, res) => {
  const userCount = await prisma.userRole.count({ where: { roleId: req.params.id } });
  if (userCount > 0) {
    res.status(409).json({ error: `Cannot delete: ${userCount} user(s) assigned to this role` });
    return;
  }

  const role = await prisma.role.findUnique({ where: { id: req.params.id } });
  if (!role) {
    res.status(404).json({ error: "Role not found" });
    return;
  }

  await prisma.role.delete({ where: { id: req.params.id } });

  await audit({
    userId: req.user!.id,
    action: "role.delete",
    entityType: "Role",
    entityId: role.id,
    metadata: { name: role.name },
    ip: ipFromReq(req),
  });

  res.status(204).end();
});

export default router;
