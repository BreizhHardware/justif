import { prisma } from "../lib/prisma.js";
import type { Request } from "express";

export type AuditAction =
  | "auth.login"
  | "auth.login_failed"
  | "user.create"
  | "user.update"
  | "expense.create"
  | "expense.update"
  | "expense.delete"
  | "expense.recalculate"
  | "expense.status"
  | "export.xlsx"
  | "export.zip"
  | "settings.update";

export interface AuditEntry {
  userId?: string | null;
  action: AuditAction;
  entityType?: string;
  entityId?: string;
  targetUserId?: string | null;
  metadata?: Record<string, unknown>;
  ip?: string | null;
}

export function ipFromReq(req: Request): string | null {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    const first = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(",")[0];
    return first?.trim() ?? null;
  }
  return req.ip ?? null;
}

// Fire-and-forget: audit failures must never break the main request flow.
export async function audit(entry: AuditEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: entry.userId ?? null,
        action: entry.action,
        entityType: entry.entityType ?? null,
        entityId: entry.entityId ?? null,
        targetUserId: entry.targetUserId ?? null,
        metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
        ip: entry.ip ?? null,
      },
    });
  } catch (err) {
    console.error("[audit] Failed to write audit log:", err);
  }
}
