import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "node:path";
import authRoutes from "./routes/auth.js";
import usersRoutes from "./routes/users.js";
import expensesRoutes from "./routes/expenses.js";
import ocrRoutes from "./routes/ocr.js";
import currenciesRoutes from "./routes/currencies.js";
import settingsRoutes from "./routes/settings.js";
import dashboardRoutes from "./routes/dashboard.js";
import auditRoutes from "./routes/audit.js";
import rolesRoutes from "./routes/roles.js";
import { requirePermission, requireAuth } from "./middleware/auth.js";
import { prisma } from "./lib/prisma.js";

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? "./uploads";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  // Only honour X-Forwarded-* when explicitly running behind a reverse proxy
  // (e.g. TRUST_PROXY=1); otherwise client IPs/headers can be spoofed.
  const trustProxy = process.env.TRUST_PROXY;
  if (trustProxy) {
    app.set("trust proxy", /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy);
  }
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "same-origin");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    next();
  });

  const configuredOrigins = [process.env.NEXT_PUBLIC_API_URL, process.env.APP_URL]
    .filter((v): v is string => Boolean(v))
    .map((v) => {
      try {
        return new URL(v).origin;
      } catch {
        return v.replace(/\/+$/, "");
      }
    });
  app.use(
    cors({
      origin: (origin, cb) => {
        // Same-origin / non-browser requests carry no Origin header. Otherwise only
        // the configured public URL(s), localhost and GitHub Codespaces are allowed.
        if (
          !origin ||
          configuredOrigins.includes(origin) ||
          /^https?:\/\/localhost(:\d+)?$/.test(origin) ||
          origin.endsWith(".app.github.dev")
        ) {
          cb(null, true);
        } else {
          cb(new Error("Not allowed by CORS"));
        }
      },
      credentials: true,
    }),
  );
  app.use(cookieParser());
  app.use(express.json());
  // Receipts contain private per-user data: authentication required.
  // Only the receipt's owner (or a user manager) may read a file, and it is served
  // in a sandbox with no script execution, whatever its content type.
  app.use(
    "/uploads",
    requireAuth,
    async (req, res, next) => {
      const relative = decodeURIComponent(req.path).replace(/^\/+/, "");
      const expense = await prisma.expense.findFirst({
        where: { fichier: relative },
        select: { userId: true },
      });
      if (!expense) {
        res.status(404).end();
        return;
      }
      if (expense.userId !== req.user!.id && !req.user!.permissions.includes("MANAGE_USERS")) {
        res.status(403).end();
        return;
      }
      res.setHeader("Content-Security-Policy", "default-src 'none'; sandbox; img-src 'self'");
      next();
    },
    express.static(path.resolve(UPLOAD_DIR), { dotfiles: "deny" }),
  );

  app.use("/api/auth", authRoutes);

  app.use("/api/users", requireAuth, usersRoutes);
  app.use("/api/roles", requireAuth, requirePermission("MANAGE_USERS"), rolesRoutes);
  app.use("/api/expenses", requireAuth, expensesRoutes);
  app.use("/api/ocr", requireAuth, ocrRoutes);
  app.use("/api/currencies", requireAuth, currenciesRoutes);
  app.use("/api/settings", requireAuth, requirePermission("MANAGE_SETTINGS"), settingsRoutes);
  app.use("/api/dashboard", requireAuth, dashboardRoutes);
  app.use("/api/audit", requireAuth, requirePermission("VIEW_AUDIT_LOG"), auditRoutes);

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  return app;
}
