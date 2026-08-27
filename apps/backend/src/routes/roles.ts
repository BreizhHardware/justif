import { Router } from "express";
import { Prisma } from "../generated/client.js";
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
  oidcGroups: { groupName: string }[];
  _count: { users: number };
}) {
  return {
    id: role.id,
    name: role.name,
    description: role.description,
    permissions: role.permissions.map((p) => p.permission),
    oidcGroups: role.oidcGroups.map((g) => g.groupName),
    userCount: role._count.users,
    createdAt: role.createdAt,
  };
}

function invalidPermissions(permissions: unknown[]): string[] {
  return permissions.filter((p) => !isValidPermission(p)) as string[];
}

// OIDC groups are normalized (trimmed, deduplicated) and each one may only be
// mapped to a single role - keeps the group -> role sync on login unambiguous.
function normalizeGroupNames(groups: unknown[]): string[] {
  return [
    ...new Set(
      groups
        .filter((g): g is string => typeof g === "string" && g.trim().length > 0)
        .map((g) => g.trim()),
    ),
  ];
}

async function conflictingGroupOwners(
  groupNames: string[],
  excludeRoleId?: string,
): Promise<{ groupName: string; roleName: string }[]> {
  if (groupNames.length === 0) return [];
  const conflicts = await prisma.roleOidcGroup.findMany({
    where: {
      groupName: { in: groupNames },
      ...(excludeRoleId ? { roleId: { not: excludeRoleId } } : {}),
    },
    include: { role: { select: { name: true } } },
  });
  return conflicts.map((c) => ({ groupName: c.groupName, roleName: c.role.name }));
}

const roleWithGroupsInclude = {
  permissions: true,
  oidcGroups: true,
  _count: { select: { users: true } },
} as const;

router.get("/", async (_req, res) => {
  const roles = await prisma.role.findMany({
    orderBy: { createdAt: "asc" },
    include: roleWithGroupsInclude,
  });
  res.json(roles.map(toRoleResponse));
});

router.post("/", async (req, res) => {
  const { name, description, permissions, oidcGroups } = req.body as {
    name?: string;
    description?: string;
    permissions?: unknown[];
    oidcGroups?: unknown[];
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
  if (oidcGroups !== undefined && !Array.isArray(oidcGroups)) {
    res.status(400).json({ error: "oidcGroups must be an array" });
    return;
  }
  const groups = normalizeGroupNames(oidcGroups ?? []);
  const conflicts = await conflictingGroupOwners(groups);
  if (conflicts.length > 0) {
    res.status(409).json({
      error: `Group(s) already mapped to another role: ${conflicts.map((c) => `${c.groupName} → ${c.roleName}`).join(", ")}`,
    });
    return;
  }

  const existing = await prisma.role.findUnique({ where: { name: name.trim() } });
  if (existing) {
    res.status(409).json({ error: "A role with this name already exists" });
    return;
  }

  let role;
  try {
    role = await prisma.$transaction(async (tx) => {
      const created = await tx.role.create({
        data: { name: name.trim(), description: description ?? null },
      });
      if (perms.length > 0) {
        await tx.rolePermission.createMany({
          data: (perms as Permission[]).map((permission) => ({ roleId: created.id, permission })),
        });
      }
      if (groups.length > 0) {
        await tx.roleOidcGroup.createMany({
          data: groups.map((groupName) => ({ roleId: created.id, groupName })),
        });
      }
      return tx.role.findUniqueOrThrow({
        where: { id: created.id },
        include: roleWithGroupsInclude,
      });
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      res.status(409).json({ error: "Group(s) already mapped to another role" });
      return;
    }
    throw err;
  }

  await audit({
    userId: req.user!.id,
    action: "role.create",
    entityType: "Role",
    entityId: role.id,
    metadata: { name: role.name, permissions: perms, oidcGroups: groups },
    ip: ipFromReq(req),
  });

  res.status(201).json(toRoleResponse(role));
});

router.patch("/:id", async (req, res) => {
  const { name, description, permissions, oidcGroups } = req.body as {
    name?: string;
    description?: string;
    permissions?: unknown[];
    oidcGroups?: unknown[];
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
  if (oidcGroups !== undefined && !Array.isArray(oidcGroups)) {
    res.status(400).json({ error: "oidcGroups must be an array" });
    return;
  }
  const groups = oidcGroups !== undefined ? normalizeGroupNames(oidcGroups) : undefined;
  if (groups !== undefined) {
    const conflicts = await conflictingGroupOwners(groups, req.params.id);
    if (conflicts.length > 0) {
      res.status(409).json({
        error: `Group(s) already mapped to another role: ${conflicts.map((c) => `${c.groupName} → ${c.roleName}`).join(", ")}`,
      });
      return;
    }
  }

  let role;
  try {
    role = await prisma.$transaction(async (tx) => {
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
      if (groups !== undefined) {
        await tx.roleOidcGroup.deleteMany({ where: { roleId: req.params.id } });
        if (groups.length > 0) {
          await tx.roleOidcGroup.createMany({
            data: groups.map((groupName) => ({ roleId: req.params.id, groupName })),
          });
        }
      }
      return tx.role.findUniqueOrThrow({
        where: { id: req.params.id },
        include: roleWithGroupsInclude,
      });
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      res.status(409).json({ error: "Group(s) already mapped to another role" });
      return;
    }
    throw err;
  }

  await audit({
    userId: req.user!.id,
    action: "role.update",
    entityType: "Role",
    entityId: role.id,
    metadata: { name: role.name, permissions: permissions ?? undefined, oidcGroups: groups },
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
