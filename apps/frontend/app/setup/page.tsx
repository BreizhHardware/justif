"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Cloud, HardDrive, LayoutGrid } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { t } from "@/lib/i18n";
import { SESSION_KEY } from "@/app/page";
import { Button, Card, Input, Label } from "@/components/ui";

type Step = 1 | 2;

export default function SetupPage() {
  const router = useRouter();
  const i18n = t();
  const [step, setStep] = useState<Step>(1);

  // Step 1
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [step1Error, setStep1Error] = useState<string | null>(null);
  const [step1Loading, setStep1Loading] = useState(false);

  // Step 2
  const [ocrProvider, setOcrProvider] = useState<"cloud" | "local">("cloud");
  const [mistralApiKey, setMistralApiKey] = useState("");
  const [mistralModel, setMistralModel] = useState("pixtral-12b-2409");
  const [ollamaUrl, setOllamaUrl] = useState("http://localhost:11434");
  const [ollamaModel, setOllamaModel] = useState("llava");
  const [step2Loading, setStep2Loading] = useState(false);

  useEffect(() => {
    apiFetch<{ setupComplete: boolean }>("/api/auth/status")
      .then((s) => { if (s.setupComplete) router.replace("/"); })
      .catch(() => {});
  }, [router]);

  async function handleStep1() {
    setStep1Error(null);
    setStep1Loading(true);
    try {
      await apiFetch("/api/auth/setup", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      localStorage.setItem(SESSION_KEY, "1");
      setStep(2);
    } catch (err) {
      setStep1Error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setStep1Loading(false);
    }
  }

  async function saveOcrConfig() {
    const payload: Record<string, string> = {
      ocr_provider: ocrProvider,
      mistral_model: mistralModel,
      ollama_url: ollamaUrl,
      ollama_model: ollamaModel,
    };
    if (ocrProvider === "cloud" && mistralApiKey) {
      payload.mistral_api_key = mistralApiKey;
    }
    await apiFetch("/api/settings", {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  }

  async function handleStep2() {
    setStep2Loading(true);
    try {
      await saveOcrConfig();
    } catch {
      // non-bloquant : configurable depuis les paramètres
    } finally {
      setStep2Loading(false);
    }
    router.push("/expenses");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-6 flex flex-col items-center gap-2">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-500">
            <LayoutGrid className="text-white" size={22} />
          </div>
          <span className="text-xl font-semibold text-slate-900">{i18n.appName}</span>
        </div>

        {/* Step indicator */}
        <div className="mb-6 flex items-start justify-center">
          {/* Step 1 */}
          <div className="flex flex-col items-center gap-1.5">
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-all ${
                step > 1
                  ? "bg-brand-500 text-white"
                  : "border-2 border-brand-500 bg-white text-brand-600"
              }`}
            >
              {step > 1 ? <Check size={13} /> : "1"}
            </div>
            <span
              className={`text-xs font-medium ${step === 1 ? "text-brand-600" : "text-slate-500"}`}
            >
              Compte
            </span>
          </div>

          {/* Connector */}
          <div className="mx-3 mt-3.5 w-16 shrink-0">
            <div
              className={`h-0.5 transition-all ${step > 1 ? "bg-brand-500" : "bg-slate-200"}`}
            />
          </div>

          {/* Step 2 */}
          <div className="flex flex-col items-center gap-1.5">
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-all ${
                step === 2
                  ? "border-2 border-brand-500 bg-white text-brand-600"
                  : "border-2 border-slate-200 bg-white text-slate-400"
              }`}
            >
              2
            </div>
            <span
              className={`text-xs font-medium ${step === 2 ? "text-brand-600" : "text-slate-400"}`}
            >
              Configuration
            </span>
          </div>
        </div>

        {/* Step 1 — Création du compte */}
        {step === 1 && (
          <Card className="p-6">
            <form onSubmit={(e) => { e.preventDefault(); void handleStep1(); }} className="space-y-4">
              <div>
                <h1 className="text-lg font-semibold text-slate-900">{i18n.setup.title}</h1>
                <p className="text-sm text-slate-500">{i18n.setup.subtitle}</p>
              </div>
              <div>
                <Label htmlFor="email">{i18n.login.email}</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="password">{i18n.login.password}</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <p className="mt-1 text-xs text-slate-400">8 caractères minimum</p>
              </div>
              {step1Error && <p className="text-sm text-red-600">{step1Error}</p>}
              <Button type="submit" disabled={step1Loading} className="w-full">
                {step1Loading ? "Création…" : i18n.setup.submit}
              </Button>
            </form>
          </Card>
        )}

        {/* Step 2 — Configuration OCR */}
        {step === 2 && (
          <Card className="p-6">
            <form onSubmit={(e) => { e.preventDefault(); void handleStep2(); }} className="space-y-4">
              <div>
                <h1 className="text-lg font-semibold text-slate-900">Configuration OCR</h1>
                <p className="text-sm text-slate-500">
                  Choisissez comment analyser vos justificatifs.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setOcrProvider("cloud")}
                  className={`flex flex-col items-center gap-2 rounded-xl border-2 px-3 py-3 transition ${
                    ocrProvider === "cloud"
                      ? "border-brand-500 bg-brand-50"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <Cloud
                    className={ocrProvider === "cloud" ? "text-brand-600" : "text-slate-400"}
                    size={20}
                  />
                  <span className="text-xs font-medium text-slate-700">Cloud (Mistral)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setOcrProvider("local")}
                  className={`flex flex-col items-center gap-2 rounded-xl border-2 px-3 py-3 transition ${
                    ocrProvider === "local"
                      ? "border-brand-500 bg-brand-50"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <HardDrive
                    className={ocrProvider === "local" ? "text-brand-600" : "text-slate-400"}
                    size={20}
                  />
                  <span className="text-xs font-medium text-slate-700">Local (Ollama)</span>
                </button>
              </div>

              {ocrProvider === "cloud" ? (
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="mistralKey">Clé API Mistral</Label>
                    <Input
                      id="mistralKey"
                      type="password"
                      placeholder="sk-…"
                      value={mistralApiKey}
                      onChange={(e) => setMistralApiKey(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="mistralModel">Modèle</Label>
                    <Input
                      id="mistralModel"
                      value={mistralModel}
                      onChange={(e) => setMistralModel(e.target.value)}
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="ollamaUrl">URL Ollama</Label>
                    <Input
                      id="ollamaUrl"
                      value={ollamaUrl}
                      onChange={(e) => setOllamaUrl(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="ollamaModel">Modèle</Label>
                    <Input
                      id="ollamaModel"
                      value={ollamaModel}
                      onChange={(e) => setOllamaModel(e.target.value)}
                    />
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-2 pt-1">
                <Button type="submit" disabled={step2Loading} className="w-full">
                  {step2Loading ? "Enregistrement…" : "Terminer la configuration"}
                </Button>
                <button
                  type="button"
                  onClick={() => router.push("/expenses")}
                  className="py-1 text-center text-sm text-slate-400 transition hover:text-slate-600"
                >
                  Passer cette étape
                </button>
              </div>
            </form>
          </Card>
        )}
      </div>
    </main>
  );
}
