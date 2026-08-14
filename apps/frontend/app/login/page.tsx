"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { LayoutGrid } from "lucide-react";
import { apiFetch, apiUrl } from "@/lib/api";
import { Button, Card, Input, Label } from "@/components/ui";

function LoginForm() {
  const router = useRouter();
  const { t } = useTranslation();
  const ssoErrorCode = useSearchParams().get("error");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [oidcEnabled, setOidcEnabled] = useState(false);

  useEffect(() => {
    apiFetch<{ oidcEnabled: boolean }>("/api/auth/status")
      .then((status) => setOidcEnabled(status?.oidcEnabled ?? false))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!ssoErrorCode) return;
    setError(t(`login.ssoErrors.${ssoErrorCode}`, { defaultValue: t("login.ssoErrors.default") }));
  }, [ssoErrorCode, t]);

  async function handleSubmit() {
    setError(null);
    setLoading(true);
    try {
      await apiFetch("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      localStorage.setItem("justif_had_session", "1");
      router.push("/dashboard");
    } catch {
      setError(t("login.error"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="p-6">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void handleSubmit();
        }}
        className="space-y-4"
      >
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          {t("login.title")}
        </h1>
        <div>
          <Label htmlFor="email">{t("login.email")}</Label>
          <Input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <div className="flex items-center justify-between">
            <Label htmlFor="password">{t("login.password")}</Label>
            <Link
              href="/forgot-password"
              className="text-xs text-brand-600 underline hover:text-brand-700 dark:text-brand-400"
            >
              {t("login.forgotPassword")}
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" disabled={loading} className="w-full">
          {t("login.submit")}
        </Button>
      </form>

      {oidcEnabled && (
        <>
          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
            <span className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">
              {t("login.ssoDivider")}
            </span>
            <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
          </div>
          <a
            href={apiUrl("/api/auth/oidc/login")}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            {t("login.ssoButton")}
          </a>
        </>
      )}
    </Card>
  );
}

export default function LoginPage() {
  const { t } = useTranslation();

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-500">
            <LayoutGrid className="text-white" size={22} />
          </div>
          <span className="text-xl font-semibold text-slate-900 dark:text-slate-100">
            {t("appName")}
          </span>
        </div>

        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>

        <p className="mt-4 text-center text-xs text-slate-400 dark:text-slate-500">
          <Link
            href="/privacy"
            className="underline hover:text-slate-600 dark:hover:text-slate-300"
          >
            {t("login.privacy")}
          </Link>
        </p>
      </div>
    </main>
  );
}
