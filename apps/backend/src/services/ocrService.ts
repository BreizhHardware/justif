import sharp from "sharp";
import { prisma } from "../lib/prisma.js";

const SYSTEM_PROMPT = `Tu es un assistant d'extraction de données de tickets de caisse
et factures. La pièce justificative peut être dans n'importe quelle
langue. Analyse l'image fournie et retourne UNIQUEMENT un objet JSON
valide (sans markdown, sans backticks) avec ces champs :
{
  "date": "YYYY-MM-DD ou null",
  "montant_ttc": number ou null,
  "montant_ht":  number ou null,
  "tva":         number ou null,
  "devise":      "code ISO 4217 (ex: EUR, USD, GBP, CHF, JPY...) ou null",
  "fournisseur": "string ou null",
  "pays":        "code ISO 3166-1 alpha-2 ou null",
  "categorie":   "string parmi : Repas, Transport, Hébergement,
                  Matériel, Logiciel, Formation, Autre",
  "description": "string court ou null",
  "langue_detectee": "code BCP 47 (ex: fr, en, de, ja...) ou null"
}
Règles importantes :
- Détecte la devise depuis le symbole (€, $, £, ¥, CHF, etc.)
  ou le texte (EUR, USD, etc.) présent sur le document.
- Si aucune devise n'est détectable, essaie de la déduire du pays
  du fournisseur.
- Les montants doivent être des nombres décimaux (ex: 12.50)
  sans symbole de devise.
- Si un champ est illisible ou absent, mets null.`;

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

// Redimensionne l'image à 1600px max côté long : suffisant pour l'OCR, plus léger à transmettre
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
): Promise<OcrResult> {
  if (!settings.mistral_api_key) {
    throw new Error("Clé API Mistral non configurée");
  }
  const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.mistral_api_key}`,
    },
    body: JSON.stringify({
      model: settings.mistral_model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: "Analyse ce justificatif." },
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
  if (!content) throw new Error("Réponse Mistral vide");
  return parseOcrJson(content);
}

async function analyzeWithOllama(base64: string, settings: OcrSettings): Promise<OcrResult> {
  const res = await fetch(`${settings.ollama_url}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: settings.ollama_model,
      stream: false,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: "Analyse ce justificatif.", images: [base64] },
      ],
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Ollama error ${res.status}: ${body}`);
  }
  const data = (await res.json()) as { message?: { content?: string } };
  const content = data.message?.content;
  if (!content) throw new Error("Réponse Ollama vide");
  return parseOcrJson(content);
}

export async function analyzeReceipt(buffer: Buffer, mimeType: string): Promise<OcrResult> {
  const settings = await loadOcrSettings();
  const { base64, mimeType: preparedMime } = await prepareImageForOcr(buffer, mimeType);

  if (settings.ocr_provider === "local") {
    return analyzeWithOllama(base64, settings);
  }
  return analyzeWithMistral(base64, preparedMime, settings);
}

export async function testOcrConnection(): Promise<{ success: boolean; message: string }> {
  const settings = await loadOcrSettings();
  try {
    if (settings.ocr_provider === "local") {
      const res = await fetch(`${settings.ollama_url}/api/tags`);
      if (!res.ok) throw new Error(`Ollama indisponible (${res.status})`);
      return { success: true, message: "Connexion Ollama réussie" };
    }
    if (!settings.mistral_api_key) {
      throw new Error("Clé API Mistral manquante");
    }
    const res = await fetch("https://api.mistral.ai/v1/models", {
      headers: { Authorization: `Bearer ${settings.mistral_api_key}` },
    });
    if (!res.ok) throw new Error(`Mistral indisponible (${res.status})`);
    return { success: true, message: "Connexion Mistral réussie" };
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : "Erreur inconnue" };
  }
}
