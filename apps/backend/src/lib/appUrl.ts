/**
 * Public origin used to build links in outgoing emails (password reset, etc).
 */
export function getAppUrl(): string {
  const configured = process.env.APP_URL?.trim();
  if (!configured) {
    throw new Error(
      "APP_URL is not configured. Set it to this instance's public URL (see .env.example) to send password reset links.",
    );
  }
  return configured.replace(/\/+$/, "");
}
