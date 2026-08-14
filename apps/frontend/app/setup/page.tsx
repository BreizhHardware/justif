"use client";

import { Fragment, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Check, Cloud, HardDrive, LayoutGrid } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { SESSION_KEY } from "@/app/page";
import { Button, Card, Input, Label } from "@/components/ui";

type Step = 1 | 2 | 3;

interface FetchedSettings {
  ocr_provider: "cloud" | "local";
  mistral_model: string;
  ollama_url: string;
  ollama_model: string;
  ocr_extract_reference_number: string;
  require_validation: string;
  mistral_api_key_set: string;
  oidc_issuer_url: string;
  oidc_client_id: string;
  oidc_scopes: string;
  oidc_groups_claim: string;
  oidc_client_secret_set: string;
}

export default function SetupPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>(1);
  const [oidcEnabled, setOidcEnabled] = useState(false);

  // Step 1
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [step1Error, setStep1Error] = useState<string | null>(null);
  const [step1Loading, setStep1Loading] = useState(false);

  // Step 2
  const [ocrProvider, setOcrProvider] = useState<"cloud" | "local">("cloud");
  const [mistralApiKey, setMistralApiKey] = useState("");
  const [mistralApiKeySet, setMistralApiKeySet] = useState(false);
  const [mistralModel, setMistralModel] = useState("pixtral-12b-2409");
  const [ollamaUrl, setOllamaUrl] = useState("http://localhost:11434");
  const [ollamaModel, setOllamaModel] = useState("llava");
  const [extractReferenceNumber, setExtractReferenceNumber] = useState(false);
  const [requireValidation, setRequireValidation] = useState(false);
  const [step2Loading, setStep2Loading] = useState(false);

  // Step 3
  const [oidcIssuerUrl, setOidcIssuerUrl] = useState("");
  const [oidcIssuerPreconfigured, setOidcIssuerPreconfigured] = useState(false);
  const [oidcClientId, setOidcClientId] = useState("");
  const [oidcClientSecret, setOidcClientSecret] = useState("");
  const [oidcClientSecretSet, setOidcClientSecretSet] = useState(false);
  const [oidcScopes, setOidcScopes] = useState("openid email profile");
  const [oidcGroupsClaim, setOidcGroupsClaim] = useState("groups");
  const [step3Loading, setStep3Loading] = useState(false);

  useEffect(() => {
    apiFetch<{ setupComplete: boolean; oidcEnabled: boolean }>("/api/auth/status")
      .then((s) => {
        if (s.setupComplete) router.replace("/");
        setOidcEnabled(Boolean(s.oidcEnabled));
      })
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

      // Existing settings (from a previous session or env vars) only become
      // readable once we're authenticated as the freshly-created admin
      try {
        const existing = await apiFetch<FetchedSettings>("/api/settings");
        setOcrProvider(existing.ocr_provider);
        setMistralModel(existing.mistral_model);
        setMistralApiKeySet(existing.mistral_api_key_set === "true");
        setOllamaUrl(existing.ollama_url);
        setOllamaModel(existing.ollama_model);
        setExtractReferenceNumber(existing.ocr_extract_reference_number === "true");
        setRequireValidation(existing.require_validation === "true");
        setOidcIssuerUrl(existing.oidc_issuer_url);
        setOidcIssuerPreconfigured(Boolean(existing.oidc_issuer_url));
        setOidcClientId(existing.oidc_client_id);
        setOidcClientSecretSet(existing.oidc_client_secret_set === "true");
        setOidcScopes(existing.oidc_scopes || "openid email profile");
        setOidcGroupsClaim(existing.oidc_groups_claim || "groups");
      } catch {
        // Non-blocking: the wizard still works with its built-in defaults.
      }

      setStep(2);
    } catch (err) {
      setStep1Error(err instanceof Error ? err.message : t("settings.error"));
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
      ocr_extract_reference_number: extractReferenceNumber ? "true" : "false",
      require_validation: requireValidation ? "true" : "false",
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
      // Non-blocking: OCR can be configured later in settings.
    } finally {
      setStep2Loading(false);
    }
    if (oidcEnabled) {
      router.push("/expenses");
    } else {
      setStep(3);
    }
  }

  async function saveOidcConfig() {
    const payload: Record<string, string> = {
      oidc_issuer_url: oidcIssuerUrl,
      oidc_client_id: oidcClientId,
      oidc_scopes: oidcScopes,
      oidc_groups_claim: oidcGroupsClaim,
    };
    if (oidcClientSecret) payload.oidc_client_secret = oidcClientSecret;
    await apiFetch("/api/settings", {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  }

  async function handleStep3() {
    setStep3Loading(true);
    try {
      await saveOidcConfig();
    } catch {
      // Non-blocking: SSO can be configured later in settings.
    } finally {
      setStep3Loading(false);
    }
    router.push("/expenses");
  }

  const steps: { n: Step; label: string }[] = [
    { n: 1, label: t("setup.stepAccount") },
    { n: 2, label: t("setup.stepConfig") },
    ...(oidcEnabled ? [] : [{ n: 3 as Step, label: t("setup.stepSso") }]),
  ];

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12 dark:bg-slate-950">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-6 flex flex-col items-center gap-2">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-500">
            <LayoutGrid className="text-white" size={22} />
          </div>
          <span className="text-xl font-semibold text-slate-900 dark:text-slate-100">
            {t("appName")}
          </span>
        </div>

        {/* Step indicator */}
        <div className="mb-6 flex items-start justify-center">
          {steps.map((s, i) => (
            <Fragment key={s.n}>
              {i > 0 && (
                <div className="mx-3 mt-3.5 w-16 shrink-0">
                  <div
                    className={`h-0.5 transition-all ${step > steps[i - 1].n ? "bg-brand-500" : "bg-slate-200 dark:bg-slate-700"}`}
                  />
                </div>
              )}
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-all ${
                    step > s.n
                      ? "bg-brand-500 text-white"
                      : step === s.n
                        ? "border-2 border-brand-500 bg-white text-brand-600 dark:bg-slate-950"
                        : "border-2 border-slate-200 bg-white text-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-500"
                  }`}
                >
                  {step > s.n ? <Check size={13} /> : s.n}
                </div>
                <span
                  className={`text-xs font-medium ${step === s.n ? "text-brand-600" : "text-slate-500 dark:text-slate-400"}`}
                >
                  {s.label}
                </span>
              </div>
            </Fragment>
          ))}
        </div>

        {/* Step 1 - Account creation */}
        {step === 1 && (
          <Card className="p-6">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleStep1();
              }}
              className="space-y-4"
            >
              <div>
                <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {t("setup.title")}
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">{t("setup.subtitle")}</p>
              </div>
              <div>
                <Label htmlFor="email">{t("login.email")}</Label>
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
                <Label htmlFor="password">{t("login.password")}</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                  {t("setup.minPassword")}
                </p>
              </div>
              {step1Error && <p className="text-sm text-red-600">{step1Error}</p>}
              <Button type="submit" disabled={step1Loading} className="w-full">
                {step1Loading ? t("setup.creating") : t("setup.submit")}
              </Button>
            </form>
          </Card>
        )}

        {/* Step 2 - OCR configuration */}
        {step === 2 && (
          <Card className="p-6">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleStep2();
              }}
              className="space-y-4"
            >
              <div>
                <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {t("setup.ocrTitle")}
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {t("setup.ocrDescription")}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setOcrProvider("cloud")}
                  className={`flex flex-col items-center gap-2 rounded-xl border-2 px-3 py-3 transition ${
                    ocrProvider === "cloud"
                      ? "border-brand-500 bg-brand-50 dark:bg-brand-950/30"
                      : "border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600"
                  }`}
                >
                  <Cloud
                    className={
                      ocrProvider === "cloud"
                        ? "text-brand-600"
                        : "text-slate-400 dark:text-slate-500"
                    }
                    size={20}
                  />
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    {t("settings.cloud")}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setOcrProvider("local")}
                  className={`flex flex-col items-center gap-2 rounded-xl border-2 px-3 py-3 transition ${
                    ocrProvider === "local"
                      ? "border-brand-500 bg-brand-50 dark:bg-brand-950/30"
                      : "border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600"
                  }`}
                >
                  <HardDrive
                    className={
                      ocrProvider === "local"
                        ? "text-brand-600"
                        : "text-slate-400 dark:text-slate-500"
                    }
                    size={20}
                  />
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    {t("settings.local")}
                  </span>
                </button>
              </div>

              {ocrProvider === "cloud" ? (
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="mistralKey">{t("setup.mistralKey")}</Label>
                    <Input
                      id="mistralKey"
                      type="password"
                      placeholder={mistralApiKeySet ? "••••••••••••" : "sk-…"}
                      value={mistralApiKey}
                      onChange={(e) => setMistralApiKey(e.target.value)}
                    />
                    {mistralApiKeySet && (
                      <p className="mt-1 text-xs text-brand-600 dark:text-brand-400">
                        {t("setup.configuredViaEnv")}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="mistralModel">{t("setup.model")}</Label>
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
                    <Label htmlFor="ollamaUrl">{t("setup.ollamaUrl")}</Label>
                    <Input
                      id="ollamaUrl"
                      value={ollamaUrl}
                      onChange={(e) => setOllamaUrl(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="ollamaModel">{t("setup.model")}</Label>
                    <Input
                      id="ollamaModel"
                      value={ollamaModel}
                      onChange={(e) => setOllamaModel(e.target.value)}
                    />
                  </div>
                </div>
              )}

              <label className="flex items-center gap-2.5 text-sm text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={extractReferenceNumber}
                  onChange={(e) => setExtractReferenceNumber(e.target.checked)}
                  className="rounded border-slate-300 text-brand-500 focus:ring-brand-200 dark:border-slate-600"
                />
                {t("settings.extractReferenceNumber")}
              </label>

              <label className="flex items-center gap-2.5 text-sm text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={requireValidation}
                  onChange={(e) => setRequireValidation(e.target.checked)}
                  className="rounded border-slate-300 text-brand-500 focus:ring-brand-200 dark:border-slate-600"
                />
                {t("settings.requireValidation")}
              </label>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                {t("settings.requireValidationHelp")}
              </p>

              <div className="flex flex-col gap-2 pt-1">
                <Button type="submit" disabled={step2Loading} className="w-full">
                  {step2Loading
                    ? t("setup.saving")
                    : oidcEnabled
                      ? t("setup.finish")
                      : t("setup.next")}
                </Button>
                <button
                  type="button"
                  onClick={() => router.push("/expenses")}
                  className="py-1 text-center text-sm text-slate-400 transition hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
                >
                  {t("setup.skip")}
                </button>
              </div>
            </form>
          </Card>
        )}

        {/* Step 3 - SSO configuration (only reachable if not already configured) */}
        {step === 3 && (
          <Card className="p-6">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleStep3();
              }}
              className="space-y-4"
            >
              <div>
                <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {t("setup.ssoTitle")}
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {t("setup.ssoDescription")}
                </p>
                <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
                  {t("settings.oidcHelp", {
                    callbackUrl:
                      typeof window !== "undefined"
                        ? `${window.location.origin}/api/auth/oidc/callback`
                        : "/api/auth/oidc/callback",
                  })}
                </p>
              </div>

              <div>
                <Label htmlFor="oidcIssuerUrl">{t("settings.oidcIssuerUrl")}</Label>
                <Input
                  id="oidcIssuerUrl"
                  value={oidcIssuerUrl}
                  onChange={(e) => setOidcIssuerUrl(e.target.value)}
                  placeholder="https://login.example.com/your-tenant"
                />
                {oidcIssuerPreconfigured && (
                  <p className="mt-1 text-xs text-brand-600 dark:text-brand-400">
                    {t("setup.configuredViaEnv")}
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="oidcClientId">{t("settings.oidcClientId")}</Label>
                <Input
                  id="oidcClientId"
                  value={oidcClientId}
                  onChange={(e) => setOidcClientId(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="oidcClientSecret">{t("settings.oidcClientSecret")}</Label>
                <Input
                  id="oidcClientSecret"
                  type="password"
                  value={oidcClientSecret}
                  onChange={(e) => setOidcClientSecret(e.target.value)}
                  placeholder={oidcClientSecretSet ? "••••••••••••" : ""}
                />
                {oidcClientSecretSet && (
                  <p className="mt-1 text-xs text-brand-600 dark:text-brand-400">
                    {t("setup.configuredViaEnv")}
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="oidcScopes">{t("settings.oidcScopes")}</Label>
                <Input
                  id="oidcScopes"
                  value={oidcScopes}
                  onChange={(e) => setOidcScopes(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="oidcGroupsClaim">{t("settings.oidcGroupsClaim")}</Label>
                <Input
                  id="oidcGroupsClaim"
                  value={oidcGroupsClaim}
                  onChange={(e) => setOidcGroupsClaim(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-2 pt-1">
                <Button type="submit" disabled={step3Loading} className="w-full">
                  {step3Loading ? t("setup.saving") : t("setup.finish")}
                </Button>
                <button
                  type="button"
                  onClick={() => router.push("/expenses")}
                  className="py-1 text-center text-sm text-slate-400 transition hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
                >
                  {t("setup.skip")}
                </button>
              </div>
            </form>
          </Card>
        )}
      </div>
    </main>
  );
}
