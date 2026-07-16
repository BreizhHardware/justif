import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma.js";
import { getUserRolesAndPermissions, type Permission } from "../lib/permissions.js";

const JWT_SECRET = process.env.JWT_SECRET ?? "change_me_in_production_min_32_chars";
const TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;
const RENEW_THRESHOLD_SECONDS = 7 * 24 * 60 * 60;

export interface AuthTokenPayload {
  sub: string;
  iat: number;
  exp: number;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: { id: string; email: string; roles: string[]; permissions: Permission[] };
    }
  }
}

export function signToken(userId: string): string {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: TOKEN_TTL_SECONDS });
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.token as string | undefined;
  if (!token) {
    res.status(401).json({ error: "Unauthenticated" });
    return;
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as AuthTokenPayload;
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.active) {
      res.status(401).json({ error: "Account disabled or not found" });
      return;
    }
    const { roles, permissions } = await getUserRolesAndPermissions(user.id);
    req.user = { id: user.id, email: user.email, roles, permissions };

    const secondsLeft = payload.exp - Math.floor(Date.now() / 1000);
    if (secondsLeft < RENEW_THRESHOLD_SECONDS) {
      const fresh = signToken(user.id);
      res.cookie("token", fresh, {
        httpOnly: true,
        sameSite: "lax",
        maxAge: TOKEN_TTL_SECONDS * 1000,
      });
    }

    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired session" });
  }
}

export function requirePermission(permission: Permission) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user?.permissions.includes(permission)) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    next();
  };
}
