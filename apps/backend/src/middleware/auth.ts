import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma.js";
import { getJwtSecret } from "../lib/jwtSecret.js";
import { getUserRolesAndPermissions, type Permission } from "../lib/permissions.js";

const JWT_SECRET = getJwtSecret();
const TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;
const RENEW_THRESHOLD_SECONDS = 7 * 24 * 60 * 60;

export interface AuthTokenPayload {
  sub: string;
  /** Session version: User.sessionsValidFrom (epoch ms) at issuance, 0 if never revoked. */
  sv?: number;
  iat: number;
  exp: number;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        theme: string;
        dashboardBreakdownBy: string;
        dashboardGranularity: string;
        roles: string[];
        permissions: Permission[];
      };
    }
  }
}

export function sessionVersion(sessionsValidFrom: Date | null | undefined): number {
  return sessionsValidFrom ? sessionsValidFrom.getTime() : 0;
}

// The token embeds the user's current session version. A password change/reset bumps
// User.sessionsValidFrom, which invalidates every token carrying the old version
// (exact comparison: no clock-resolution gap, unlike comparing against `iat`).
export function signToken(userId: string, sessionsValidFrom?: Date | null): string {
  return jwt.sign({ sub: userId, sv: sessionVersion(sessionsValidFrom) }, JWT_SECRET, {
    expiresIn: TOKEN_TTL_SECONDS,
  });
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
    if ((payload.sv ?? 0) !== sessionVersion(user.sessionsValidFrom)) {
      res.status(401).json({ error: "Invalid or expired session" });
      return;
    }
    const { roles, permissions } = await getUserRolesAndPermissions(user.id);
    req.user = {
      id: user.id,
      email: user.email,
      theme: user.theme,
      dashboardBreakdownBy: user.dashboardBreakdownBy,
      dashboardGranularity: user.dashboardGranularity,
      roles,
      permissions,
    };

    const secondsLeft = payload.exp - Math.floor(Date.now() / 1000);
    if (secondsLeft < RENEW_THRESHOLD_SECONDS) {
      // Re-read the version: a password change may have committed since we loaded `user`.
      const current = await prisma.user.findUnique({
        where: { id: user.id },
        select: { active: true, sessionsValidFrom: true },
      });
      if (
        !current ||
        !current.active ||
        (payload.sv ?? 0) !== sessionVersion(current.sessionsValidFrom)
      ) {
        res.status(401).json({ error: "Invalid or expired session" });
        return;
      }
      const fresh = signToken(user.id, current.sessionsValidFrom);
      res.cookie("token", fresh, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.COOKIE_SECURE === "true",
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
