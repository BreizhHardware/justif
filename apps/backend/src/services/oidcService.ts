import * as client from "openid-client";
import { prisma } from "../lib/prisma.js";

export interface OidcSettings {
  issuerUrl: string;
  clientId: string;
  clientSecret: string;
  scopes: string;
  groupsClaim: string;
}

const ENV_DEFAULTS: Record<string, string> = {
  oidc_issuer_url: process.env.OIDC_ISSUER_URL ?? "",
  oidc_client_id: process.env.OIDC_CLIENT_ID ?? "",
  oidc_client_secret: process.env.OIDC_CLIENT_SECRET ?? "",
  oidc_scopes: process.env.OIDC_SCOPES ?? "openid email profile",
  oidc_groups_claim: process.env.OIDC_GROUPS_CLAIM ?? "groups",
};

async function getSetting(key: string): Promise<string> {
  const row = await prisma.setting.findUnique({ where: { key } });
  return row?.value ?? ENV_DEFAULTS[key] ?? "";
}

/** Returns null when SSO hasn't been configured yet (no issuer or client set). */
export async function getOidcSettings(): Promise<OidcSettings | null> {
  const [issuerUrl, clientId, clientSecret, scopes, groupsClaim] = await Promise.all([
    getSetting("oidc_issuer_url"),
    getSetting("oidc_client_id"),
    getSetting("oidc_client_secret"),
    getSetting("oidc_scopes"),
    getSetting("oidc_groups_claim"),
  ]);

  if (!issuerUrl || !clientId || !clientSecret) return null;

  return {
    issuerUrl,
    clientId,
    clientSecret,
    scopes: scopes || "openid email profile",
    groupsClaim: groupsClaim || "groups",
  };
}

// Not cached: SSO logins are infrequent enough that re-running discovery on
// every login/callback is cheap, and it means a settings change takes effect
// immediately without needing cache invalidation plumbing.
export async function discoverOidcClient(): Promise<{
  config: client.Configuration;
  settings: OidcSettings;
} | null> {
  const settings = await getOidcSettings();
  if (!settings) return null;
  // oauth4webapi rejects plain HTTP issuers by default. A non-HTTPS issuer
  // only happens with a self-hosted dev IdP (e.g. the keycloak container in
  // docker-compose.dev.yml) - opt in to insecure requests for that case only.
  const isHttp = new URL(settings.issuerUrl).protocol === "http:";
  const config = await client.discovery(
    new URL(settings.issuerUrl),
    settings.clientId,
    settings.clientSecret,
    undefined,
    isHttp ? { execute: [client.allowInsecureRequests] } : undefined,
  );
  return { config, settings };
}
