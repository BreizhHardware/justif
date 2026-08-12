import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { audit, ipFromReq } from "../services/auditService.js";
import { sendTestEmail } from "../services/emailService.js";

const router = Router();

const PUBLIC_KEYS = [
  "ocr_provider",
  "mistral_model",
  "ollama_url",
  "ollama_model",
  "default_currency",
  "ocr_prompt_override",
  "ocr_extract_reference_number",
  "require_validation",
  "smtp_host",
  "smtp_port",
  "smtp_secure",
  "smtp_user",
  "smtp_from",
];
const SECRET_KEYS = ["mistral_api_key", "smtp_password"];
const ALL_KEYS = [...PUBLIC_KEYS, ...SECRET_KEYS];

const DEFAULTS: Record<string, string> = {
  ocr_provider: process.env.OCR_PROVIDER ?? "cloud",
  mistral_api_key: process.env.MISTRAL_API_KEY ?? "",
  mistral_model: process.env.MISTRAL_MODEL ?? "pixtral-12b-2409",
  ollama_url: process.env.OLLAMA_URL ?? "http://localhost:11434",
  ollama_model: process.env.OLLAMA_MODEL ?? "llava",
  default_currency: process.env.DEFAULT_CURRENCY ?? "EUR",
  ocr_prompt_override: "",
  ocr_extract_reference_number: "false",
  require_validation: "false",
  smtp_host: process.env.SMTP_HOST ?? "",
  smtp_port: process.env.SMTP_PORT ?? "587",
  smtp_secure: process.env.SMTP_SECURE ?? "false",
  smtp_user: process.env.SMTP_USER ?? "",
  smtp_password: process.env.SMTP_PASSWORD ?? "",
  smtp_from: process.env.SMTP_FROM ?? "",
};

router.get("/", async (_req, res) => {
  const rows = await prisma.setting.findMany({ where: { key: { in: PUBLIC_KEYS } } });
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const result: Record<string, string> = {};
  for (const key of PUBLIC_KEYS) {
    result[key] = map.get(key) ?? DEFAULTS[key] ?? "";
  }
  // Indicate whether secret keys are configured without ever returning their value.
  const mistralRow = await prisma.setting.findUnique({ where: { key: "mistral_api_key" } });
  result.mistral_api_key_set = String(Boolean(mistralRow?.value ?? DEFAULTS.mistral_api_key));
  const smtpPasswordRow = await prisma.setting.findUnique({ where: { key: "smtp_password" } });
  result.smtp_password_set = String(Boolean(smtpPasswordRow?.value ?? DEFAULTS.smtp_password));
  res.json(result);
});

router.patch("/", async (req, res) => {
  const body = req.body as Record<string, string>;
  const updates = Object.entries(body).filter(([key]) => ALL_KEYS.includes(key));

  await Promise.all(
    updates.map(([key, value]) =>
      prisma.setting.upsert({
        where: { key },
        update: { value: String(value) },
        create: { key, value: String(value) },
      }),
    ),
  );

  // Log key names only - never values (secret keys must not appear in audit metadata).
  await audit({
    userId: req.user!.id,
    action: "settings.update",
    metadata: { keys: updates.map(([key]) => key) },
    ip: ipFromReq(req),
  });

  const rows = await prisma.setting.findMany({ where: { key: { in: PUBLIC_KEYS } } });
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const result: Record<string, string> = {};
  for (const key of PUBLIC_KEYS) {
    result[key] = map.get(key) ?? DEFAULTS[key] ?? "";
  }
  res.json(result);
});

router.post("/test-email", async (req, res) => {
  try {
    await sendTestEmail(req.user!.email);
    res.json({ success: true, message: `Test email sent to ${req.user!.email}` });
  } catch (err) {
    res
      .status(502)
      .json({
        success: false,
        message: err instanceof Error ? err.message : "Failed to send test email",
      });
  }
});

export async function getDefaultCurrency(): Promise<string> {
  const row = await prisma.setting.findUnique({ where: { key: "default_currency" } });
  return row?.value ?? DEFAULTS.default_currency ?? "EUR";
}

export async function getRequireValidation(): Promise<boolean> {
  const row = await prisma.setting.findUnique({ where: { key: "require_validation" } });
  return (row?.value ?? DEFAULTS.require_validation) === "true";
}

export default router;
