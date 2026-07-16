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

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? "./uploads";

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: process.env.NEXT_PUBLIC_API_URL
        ? true
        : (origin, cb) => {
            // Allow localhost (any port) and GitHub Codespaces forwarded URLs
            if (
              !origin ||
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
  app.use("/uploads", requireAuth, express.static(path.resolve(UPLOAD_DIR)));

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
