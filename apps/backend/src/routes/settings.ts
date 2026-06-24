import { Router } from "express";
import { prisma } from "../lib/prisma.js";

const router = Router();

const PUBLIC_KEYS = [
  "ocr_provider",
  "mistral_model",
  "ollama_url",
  "ollama_model",
  "default_currency",
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
};

router.get("/", async (_req, res) => {
  const rows = await prisma.setting.findMany({ where: { key: { in: PUBLIC_KEYS } } });
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const result: Record<string, string> = {};
  for (const key of PUBLIC_KEYS) {
    result[key] = map.get(key) ?? DEFAULTS[key] ?? "";
  }
  // indique si une clé Mistral est configurée, sans jamais la renvoyer
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

export default router;
