import { Router } from "express";
import multer from "multer";
import { requirePermission } from "../middleware/auth.js";
import { analyzeReceipt, testOcrConnection } from "../services/ocrService.js";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (!allowed.includes(file.mimetype)) {
      cb(new Error("Unsupported format. Use JPEG, PNG, WebP or PDF."));
      return;
    }
    cb(null, true);
  },
});

router.post("/analyze", upload.single("fichier"), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "No file provided" });
    return;
  }
  const locale = (req.headers["accept-language"] ?? "en").split(",")[0]?.trim() ?? "en";
  try {
    const result = await analyzeReceipt(req.file.buffer, req.file.mimetype, locale);
    res.json(result);
  } catch (err) {
    console.error("[ocr] Analysis error:", err);
    res.status(502).json({ error: err instanceof Error ? err.message : "OCR error" });
  }
});

router.post("/test", requirePermission("CONFIG_OCR"), async (_req, res) => {
  const result = await testOcrConnection();
  res.status(result.success ? 200 : 502).json(result);
});

export default router;
