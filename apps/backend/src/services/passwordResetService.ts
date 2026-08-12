import crypto from "node:crypto";
import { prisma } from "../lib/prisma.js";

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

function hashToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

/**
 * Creates a new password reset token for the user and returns the raw value
 * to embed in the email link. Only its hash is persisted, so a database leak
 * alone can't be used to reset accounts. Any previously issued, still-valid
 * token for this user is invalidated so only the newest link works.
 */
export async function createPasswordResetToken(userId: string): Promise<string> {
  await prisma.passwordResetToken.updateMany({
    where: { userId, usedAt: null },
    data: { usedAt: new Date() },
  });

  const rawToken = crypto.randomBytes(32).toString("hex");
  await prisma.passwordResetToken.create({
    data: {
      userId,
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
    },
  });

  return rawToken;
}

/**
 * Validates and consumes a raw token. Returns the associated user id on
 * success, or null if the token is unknown, already used, or expired.
 */
export async function consumePasswordResetToken(rawToken: string): Promise<string | null> {
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(rawToken) },
  });
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    return null;
  }

  await prisma.passwordResetToken.update({
    where: { id: record.id },
    data: { usedAt: new Date() },
  });
  return record.userId;
}
