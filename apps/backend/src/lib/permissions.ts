import { prisma } from "./prisma.js";

export const PERMISSIONS = [
  "EXPORT",
  "CONFIG_OCR",
  "VIEW_DASHBOARD",
  "MANAGE_USERS",
  "MANAGE_SETTINGS",
  "VIEW_AUDIT_LOG",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export function isValidPermission(p: unknown): p is Permission {
  return typeof p === "string" && (PERMISSIONS as readonly string[]).includes(p);
}

export const SEED_ROLE_NAMES = { ADMIN: "Admin", USER: "User" } as const;

export async function getUserRolesAndPermissions(
  userId: string,
): Promise<{ roles: string[]; permissions: Permission[] }> {
  const userRoles = await prisma.userRole.findMany({
    where: { userId },
    include: { role: { include: { permissions: true } } },
  });
  const roles = userRoles.map((ur) => ur.role.name);
  const permissions = [
    ...new Set(userRoles.flatMap((ur) => ur.role.permissions.map((p) => p.permission))),
  ] as Permission[];
  return { roles, permissions };
}
