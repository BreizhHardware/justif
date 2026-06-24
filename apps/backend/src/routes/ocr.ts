import { Router } from "express";
import multer from "multer";
import { analyzeReceipt, testOcrConnection } from "../services/ocrService.js";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (!allowed.includes(file.mimetype)) {
      cb(new Error("Format non supporté. Utilisez JPEG, PNG, WebP ou PDF."));
      return;
    }
    cb(null, true);
  },
});

router.post("/analyze", upload.single("fichier"), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "Aucun fichier fourni" });
    return;
  }
  try {
    const result = await analyzeReceipt(req.file.buffer, req.file.mimetype);
    res.json(result);
  } catch (err) {
    console.error("[ocr] Erreur d'analyse:", err);
    res.status(502).json({ error: err instanceof Error ? err.message : "Erreur OCR inconnue" });
  }
});

router.post("/test", async (_req, res) => {
  const result = await testOcrConnection();
  res.status(result.success ? 200 : 502).json(result);
});

export default router;
