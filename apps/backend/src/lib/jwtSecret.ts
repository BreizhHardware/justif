const PLACEHOLDER = "change_me_in_production_min_32_chars";
const MIN_LENGTH = 32;

/**
 * Returns the JWT signing secret. Refuses to run with a missing, short or
 * placeholder secret (a publicly known secret lets anyone forge admin tokens).
 * Only NODE_ENV=development / test tolerate a weak secret, for local work.
 */
export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  const lenient = process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test";
  const weak = !secret || secret.length < MIN_LENGTH || secret === PLACEHOLDER;
  if (weak && !lenient) {
    throw new Error(
      `JWT_SECRET must be set to a unique random value of at least ${MIN_LENGTH} characters (e.g. \`openssl rand -hex 32\`).`,
    );
  }
  return secret ?? PLACEHOLDER;
}
