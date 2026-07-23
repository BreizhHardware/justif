import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { audit, ipFromReq } from "../services/auditService.js";

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
];
const SECRET_KEYS = ["mistral_api_key"];
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
};

router.get("/", async (_req, res) => {
  const rows = await prisma.setting.findMany({ where: { key: { in: PUBLIC_KEYS } } });
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const result: Record<string, string> = {};
  for (const key of PUBLIC_KEYS) {
    result[key] = map.get(key) ?? DEFAULTS[key] ?? "";
  }
  // Indicate whether a Mistral key is configured without ever returning its value.
  const mistralRow = await prisma.setting.findUnique({ where: { key: "mistral_api_key" } });
  result.mistral_api_key_set = String(Boolean(mistralRow?.value ?? DEFAULTS.mistral_api_key));
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

  // Log key names only — never values (secret keys must not appear in audit metadata).
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

export async function getDefaultCurrency(): Promise<string> {
  const row = await prisma.setting.findUnique({ where: { key: "default_currency" } });
  return row?.value ?? DEFAULTS.default_currency ?? "EUR";
}

export async function getRequireValidation(): Promise<boolean> {
  const row = await prisma.setting.findUnique({ where: { key: "require_validation" } });
  return (row?.value ?? DEFAULTS.require_validation) === "true";
}

export default router;
