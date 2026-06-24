import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "node:path";
import authRoutes from "./routes/auth.js";
import expensesRoutes from "./routes/expenses.js";
import ocrRoutes from "./routes/ocr.js";
import currenciesRoutes from "./routes/currencies.js";
import settingsRoutes from "./routes/settings.js";
import { requireAuth } from "./middleware/auth.js";

const app = express();
const PORT = Number(process.env.PORT ?? 3001);
const UPLOAD_DIR = process.env.UPLOAD_DIR ?? "./uploads";

app.use(
  cors({
    origin: process.env.NEXT_PUBLIC_API_URL ? true : "http://localhost:3000",
    credentials: true,
  }),
);
app.use(cookieParser());
app.use(express.json());
app.use("/uploads", express.static(path.resolve(UPLOAD_DIR)));

app.use("/api/auth", authRoutes);

app.use("/api/expenses", requireAuth, expensesRoutes);
app.use("/api/ocr", requireAuth, ocrRoutes);
app.use("/api/currencies", requireAuth, currenciesRoutes);
app.use("/api/settings", requireAuth, settingsRoutes);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.listen(PORT, () => {
  console.log(`Justif backend démarré sur http://localhost:${PORT}`);
});
