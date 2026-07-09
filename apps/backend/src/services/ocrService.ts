import sharp from "sharp";
import { prisma } from "../lib/prisma.js";

// Category values are canonical French strings stored in the database.
// They must stay identical in both prompts so the AI returns a value that
// matches what is persisted (and used for filtering) in the UI.
const CATEGORIES = "Repas, Transport, Hébergement, Matériel, Logiciel, Formation, Autre";

const SYSTEM_PROMPTS = {
  fr: `Tu es un assistant d'extraction de données de tickets de caisse et factures.
La pièce justificative peut être dans n'importe quelle langue.
Analyse l'image fournie et retourne UNIQUEMENT un objet JSON valide
(sans markdown, sans backticks) avec ces champs :
{
  "date": "YYYY-MM-DD ou null",
  "montant_ttc": nombre ou null,
  "montant_ht":  nombre ou null,
  "tva":         nombre ou null,
  "devise":      "code ISO 4217 (ex: EUR, USD, GBP, CHF, JPY...) ou null",
  "fournisseur": "string ou null",
  "pays":        "code ISO 3166-1 alpha-2 ou null",
  "categorie":   "string parmi : ${CATEGORIES}",
  "description": "string court ou null",
  "langue_detectee": "code BCP 47 (ex: fr, en, de, ja...) ou null"
}
Règles importantes :
- Détecte la devise depuis le symbole (€, $, £, ¥, CHF, etc.) ou le texte (EUR, USD, etc.) présent sur le document.
- Si aucune devise n'est détectable, essaie de la déduire du pays du fournisseur.
- Les montants doivent être des nombres décimaux (ex: 12.50) sans symbole de devise.
- Si un champ est illisible ou absent, mets null.`,

  en: `You are a data extraction assistant for receipts and invoices.
The document may be in any language.
Analyze the provided image and return ONLY a valid JSON object
(no markdown, no backticks) with these fields:
{
  "date": "YYYY-MM-DD or null",
  "montant_ttc": number or null,
  "montant_ht":  number or null,
  "tva":         number or null,
  "devise":      "ISO 4217 code (e.g. EUR, USD, GBP, CHF, JPY...) or null",
  "fournisseur": "string or null",
  "pays":        "ISO 3166-1 alpha-2 code or null",
  "categorie":   "one of: ${CATEGORIES}",
  "description": "short string or null",
  "langue_detectee": "BCP 47 code (e.g. fr, en, de, ja...) or null"
}
Important rules:
- Detect the currency from the symbol (€, $, £, ¥, CHF, etc.) or text (EUR, USD, etc.) on the document.
- If no currency is detectable, try to infer it from the vendor's country.
- Amounts must be decimal numbers (e.g. 12.50) without currency symbols.
- If a field is unreadable or missing, set it to null.`,
};

function getSystemPrompt(locale: string): string {
  const lang = (locale.split("-")[0] ?? locale).toLowerCase() as keyof typeof SYSTEM_PROMPTS;
  return SYSTEM_PROMPTS[lang] ?? SYSTEM_PROMPTS.en;
}

export interface OcrResult {
  date: string | null;
  montant_ttc: number | null;
  montant_ht: number | null;
  tva: number | null;
  devise: string | null;
  fournisseur: string | null;
  pays: string | null;
  categorie: string;
  description: string | null;
  langue_detectee: string | null;
}

interface OcrSettings {
  ocr_provider: "cloud" | "local";
  mistral_api_key: string;
  mistral_model: string;
  ollama_url: string;
  ollama_model: string;
}

export async function loadOcrSettings(): Promise<OcrSettings> {
  const rows = await prisma.setting.findMany();
  const map = new Map(rows.map((r) => [r.key, r.value]));
  return {
    ocr_provider:
      (map.get("ocr_provider") as "cloud" | "local") ??
      (process.env.OCR_PROVIDER as "cloud" | "local") ??
      "cloud",
    mistral_api_key: map.get("mistral_api_key") ?? process.env.MISTRAL_API_KEY ?? "",
    mistral_model: map.get("mistral_model") ?? process.env.MISTRAL_MODEL ?? "pixtral-12b-2409",
    ollama_url: map.get("ollama_url") ?? process.env.OLLAMA_URL ?? "http://localhost:11434",
    ollama_model: map.get("ollama_model") ?? process.env.OLLAMA_MODEL ?? "llava",
  };
}

// Resize the image to 1600px on the longest side: sufficient for OCR, lighter to transmit.
export async function prepareImageForOcr(
  buffer: Buffer,
  mimeType: string,
): Promise<{ base64: string; mimeType: string }> {
  if (mimeType === "application/pdf") {
    return { base64: buffer.toString("base64"), mimeType };
  }
  const resized = await sharp(buffer)
    .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();
  return { base64: resized.toString("base64"), mimeType: "image/jpeg" };
}

function parseOcrJson(content: string): OcrResult {
  const cleaned = content
    .trim()
    .replace(/^```(json)?/i, "")
    .replace(/```$/, "")
    .trim();
  const parsed = JSON.parse(cleaned);
  return {
    date: parsed.date ?? null,
    montant_ttc: parsed.montant_ttc ?? null,
    montant_ht: parsed.montant_ht ?? null,
    tva: parsed.tva ?? null,
    devise: parsed.devise ?? null,
    fournisseur: parsed.fournisseur ?? null,
    pays: parsed.pays ?? null,
    categorie: parsed.categorie ?? "Autre",
    description: parsed.description ?? null,
    langue_detectee: parsed.langue_detectee ?? null,
  };
}

async function analyzeWithMistral(
  base64: string,
  mimeType: string,
  settings: OcrSettings,
  locale: string,
): Promise<OcrResult> {
  if (!settings.mistral_api_key) {
    throw new Error("Mistral API key not configured");
  }
  const systemPrompt = getSystemPrompt(locale);
  const userText = locale.startsWith("fr") ? "Analyse ce justificatif." : "Analyze this receipt.";
  const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.mistral_api_key}`,
    },
    body: JSON.stringify({
      model: settings.mistral_model,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            { type: "text", text: userText },
            { type: "image_url", image_url: `data:${mimeType};base64,${base64}` },
          ],
        },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Mistral API error ${res.status}: ${body}`);
  }
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Empty Mistral response");
  return parseOcrJson(content);
}

async function analyzeWithOllama(
  base64: string,
  settings: OcrSettings,
  locale: string,
): Promise<OcrResult> {
  const systemPrompt = getSystemPrompt(locale);
  const userText = locale.startsWith("fr") ? "Analyse ce justificatif." : "Analyze this receipt.";
  const res = await fetch(`${settings.ollama_url}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: settings.ollama_model,
      stream: false,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userText, images: [base64] },
      ],
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Ollama error ${res.status}: ${body}`);
  }
  const data = (await res.json()) as { message?: { content?: string } };
  const content = data.message?.content;
  if (!content) throw new Error("Empty Ollama response");
  return parseOcrJson(content);
}

export async function analyzeReceipt(
  buffer: Buffer,
  mimeType: string,
  locale = "en",
): Promise<OcrResult> {
  const settings = await loadOcrSettings();
  const { base64, mimeType: preparedMime } = await prepareImageForOcr(buffer, mimeType);

  if (settings.ocr_provider === "local") {
    return analyzeWithOllama(base64, settings, locale);
  }
  return analyzeWithMistral(base64, preparedMime, settings, locale);
}

export async function testOcrConnection(): Promise<{ success: boolean; message: string }> {
  const settings = await loadOcrSettings();
  try {
    if (settings.ocr_provider === "local") {
      const res = await fetch(`${settings.ollama_url}/api/tags`);
      if (!res.ok) throw new Error(`Ollama unavailable (${res.status})`);
      return { success: true, message: "Ollama connection successful" };
    }
    if (!settings.mistral_api_key) {
      throw new Error("Mistral API key not set");
    }
    const res = await fetch("https://api.mistral.ai/v1/models", {
      headers: { Authorization: `Bearer ${settings.mistral_api_key}` },
    });
    if (!res.ok) throw new Error(`Mistral unavailable (${res.status})`);
    return { success: true, message: "Mistral connection successful" };
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : "Unknown error" };
  }
}
