"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { LayoutGrid } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api";
import { Button, Card, Input, Label } from "@/components/ui";

function ResetPasswordForm() {
  const router = useRouter();
  const { t } = useTranslation();
  const token = useSearchParams().get("token");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit() {
    setError(null);
    if (password !== confirmPassword) {
      setError(t("resetPassword.mismatch"));
      return;
    }
    if (!token) {
      setError(t("resetPassword.missingToken"));
      return;
    }

    setLoading(true);
    try {
      await apiFetch("/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, password }),
      });
      setSuccess(true);
      localStorage.setItem("justif_had_session", "1");
      router.push("/dashboard");
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 400
          ? t("resetPassword.invalidToken")
          : t("resetPassword.genericError"),
      );
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-red-600">{t("resetPassword.missingToken")}</p>
        <Link
          href="/forgot-password"
          className="text-sm text-brand-600 underline hover:text-brand-700"
        >
          {t("resetPassword.requestNewLink")}
        </Link>
      </div>
    );
  }

  if (success) {
    return (
      <p className="text-sm text-slate-600 dark:text-slate-400">{t("resetPassword.success")}</p>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void handleSubmit();
      }}
      className="space-y-4"
    >
      <div>
        <Label htmlFor="password">{t("resetPassword.password")}</Label>
        <Input
          id="password"
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
          {t("resetPassword.minPassword")}
        </p>
      </div>
      <div>
        <Label htmlFor="confirmPassword">{t("resetPassword.confirmPassword")}</Label>
        <Input
          id="confirmPassword"
          type="password"
          required
          minLength={8}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" disabled={loading} className="w-full">
        {loading ? t("resetPassword.saving") : t("resetPassword.submit")}
      </Button>
    </form>
  );
}

export default function ResetPasswordPage() {
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

        <Card className="p-6">
          <h1 className="mb-4 text-lg font-semibold text-slate-900 dark:text-slate-100">
            {t("resetPassword.title")}
          </h1>
          <Suspense fallback={null}>
            <ResetPasswordForm />
          </Suspense>
        </Card>
      </div>
    </main>
  );
}
