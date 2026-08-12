import type { Request } from "express";

/**
 * Public origin used to build links in outgoing emails (password reset, etc).
 * Frontend and backend share the same origin in production (see docker/proxy.mjs),
 * so the incoming request's own origin is a safe default. APP_URL overrides it
 * for setups where that doesn't hold (e.g. a reverse proxy that rewrites Host).
 */
export function getAppUrl(req: Request): string {
  const configured = process.env.APP_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");

  const proto = req.get("x-forwarded-proto") ?? req.protocol;
  const host = req.get("x-forwarded-host") ?? req.get("host");
  return `${proto}://${host}`;
}
