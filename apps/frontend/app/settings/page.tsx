"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { CheckCircle2, Cloud, HardDrive, XCircle } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { apiFetch } from "@/lib/api";
import { COMMON_CURRENCIES } from "@/lib/currencies";
import { Button, Card, Input, Label, PageHeader, Select, Textarea } from "@/components/ui";

interface Settings {
  ocr_provider: "cloud" | "local";
  mistral_model: string;
  ollama_url: string;
  ollama_model: string;
  default_currency: string;
  ocr_prompt_override: string;
  ocr_extract_reference_number: string;
  require_validation: string;
  mistral_api_key_set: string;
}

export default function SettingsPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [mistralApiKey, setMistralApiKey] = useState("");
  const [saved, setSaved] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    apiFetch<Settings>("/api/settings")
      .then(setSettings)
      .catch(() => router.replace("/expenses"));
  }, [router]);

  if (!settings) return null;

  async function handleSave() {
    setSaved(false);
    const payload: Record<string, string> = {
      ocr_provider: settings!.ocr_provider,
      mistral_model: settings!.mistral_model,
      ollama_url: settings!.ollama_url,
      ollama_model: settings!.ollama_model,
      default_currency: settings!.default_currency,
      ocr_prompt_override: settings!.ocr_prompt_override,
      ocr_extract_reference_number: settings!.ocr_extract_reference_number,
      require_validation: settings!.require_validation,
    };
    if (mistralApiKey) payload.mistral_api_key = mistralApiKey;
    const updated = await apiFetch<Settings>("/api/settings", {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    setSettings(updated);
    setMistralApiKey("");
    setSaved(true);
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await apiFetch<{ success: boolean; message: string }>("/api/ocr/test", {
        method: "POST",
      });
      setTestResult(result);
    } catch (err) {
      setTestResult({
        success: false,
        message: err instanceof Error ? err.message : t("settings.error"),
      });
    } finally {
      setTesting(false);
    }
  }

  return (
    <AppShell>
      <PageHeader title={t("settings.title")} />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void handleSave();
        }}
        className="max-w-2xl space-y-6"
      >
        <Card className="p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
            {t("settings.ocrProvider")}
          </h2>

          <div className="mb-5 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setSettings({ ...settings, ocr_provider: "cloud" })}
              className={`flex flex-col items-center gap-2 rounded-xl border-2 px-4 py-4 transition ${
                settings.ocr_provider === "cloud"
                  ? "border-brand-500 bg-brand-50"
                  : "border-slate-200 hover:border-slate-300"
              }`}
            >
              <Cloud
                className={settings.ocr_provider === "cloud" ? "text-brand-600" : "text-slate-400"}
                size={22}
              />
              <span className="text-sm font-medium text-slate-700">{t("settings.cloud")}</span>
            </button>
            <button
              type="button"
              onClick={() => setSettings({ ...settings, ocr_provider: "local" })}
              className={`flex flex-col items-center gap-2 rounded-xl border-2 px-4 py-4 transition ${
                settings.ocr_provider === "local"
                  ? "border-brand-500 bg-brand-50"
                  : "border-slate-200 hover:border-slate-300"
              }`}
            >
              <HardDrive
                className={settings.ocr_provider === "local" ? "text-brand-600" : "text-slate-400"}
                size={22}
              />
              <span className="text-sm font-medium text-slate-700">{t("settings.local")}</span>
            </button>
          </div>

          {settings.ocr_provider === "cloud" ? (
            <div className="space-y-4">
              <div>
                <Label htmlFor="apiKey">{t("settings.apiKey")}</Label>
                <Input
                  id="apiKey"
                  type="password"
                  value={mistralApiKey}
                  onChange={(e) => setMistralApiKey(e.target.value)}
                  placeholder={settings.mistral_api_key_set === "true" ? "••••••••••••" : ""}
                />
              </div>
              <div>
                <Label htmlFor="mistralModel">{t("settings.model")}</Label>
                <Input
                  id="mistralModel"
                  value={settings.mistral_model}
                  onChange={(e) => setSettings({ ...settings, mistral_model: e.target.value })}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <Label htmlFor="ollamaUrl">{t("settings.ollamaUrl")}</Label>
                <Input
                  id="ollamaUrl"
                  value={settings.ollama_url}
                  onChange={(e) => setSettings({ ...settings, ollama_url: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="ollamaModel">{t("settings.model")}</Label>
                <Input
                  id="ollamaModel"
                  value={settings.ollama_model}
                  onChange={(e) => setSettings({ ...settings, ollama_model: e.target.value })}
                />
              </div>
            </div>
          )}

          <div className="mt-5 flex items-center gap-3">
            <Button type="button" variant="secondary" onClick={handleTest} disabled={testing}>
              {t("settings.testConnection")}
            </Button>
            {testResult && (
              <span
                className={`flex items-center gap-1.5 text-sm ${testResult.success ? "text-brand-600" : "text-red-600"}`}
              >
                {testResult.success ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                {testResult.message}
              </span>
            )}
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
            {t("settings.ocrPromptOverride")}
          </h2>
          <p className="mb-4 text-sm text-slate-500">{t("settings.ocrPromptOverrideHelp")}</p>
          <Textarea
            rows={4}
            value={settings.ocr_prompt_override}
            onChange={(e) => setSettings({ ...settings, ocr_prompt_override: e.target.value })}
            placeholder={t("settings.ocrPromptOverridePlaceholder")}
          />

          <label className="mt-4 flex items-center gap-2.5 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={settings.ocr_extract_reference_number === "true"}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  ocr_extract_reference_number: e.target.checked ? "true" : "false",
                })
              }
              className="rounded border-slate-300 text-brand-500 focus:ring-brand-200"
            />
            {t("settings.extractReferenceNumber")}
          </label>
          <p className="mt-1 text-xs text-slate-400">
            {t("settings.extractReferenceNumberHelp")}
          </p>
        </Card>

        <Card className="p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
            {t("settings.defaultCurrency")}
          </h2>
          <Select
            value={settings.default_currency}
            onChange={(e) => setSettings({ ...settings, default_currency: e.target.value })}
            className="max-w-xs"
          >
            {COMMON_CURRENCIES.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </Select>
        </Card>

        <Card className="p-6">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
            {t("settings.requireValidation")}
          </h2>
          <p className="mb-4 text-sm text-slate-500">{t("settings.requireValidationHelp")}</p>
          <label className="flex items-center gap-2.5 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={settings.require_validation === "true"}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  require_validation: e.target.checked ? "true" : "false",
                })
              }
              className="rounded border-slate-300 text-brand-500 focus:ring-brand-200"
            />
            {t("settings.requireValidation")}
          </label>
        </Card>

        <div className="flex items-center gap-3">
          <Button type="submit">{t("settings.save")}</Button>
          {saved && <span className="text-sm text-brand-600">{t("settings.saved")}</span>}
        </div>
      </form>
    </AppShell>
  );
}
