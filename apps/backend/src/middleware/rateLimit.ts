import rateLimit from "express-rate-limit";

// Brute-force protection for credential endpoints. Disabled under test (and for e2e via RATE_LIMIT_DISABLED=true).
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === "test" || process.env.RATE_LIMIT_DISABLED === "true",
  message: { error: "Too many attempts, please try again later" },
});
