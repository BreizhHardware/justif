"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { LayoutGrid } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Button, Card, Input, Label } from "@/components/ui";

export default function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit() {
    setLoading(true);
    try {
      await apiFetch("/api/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
    } catch {
      // Ignored on purpose: the backend always returns the same generic
      // response whether or not the account exists, so the UI must never
      // branch on success vs. failure here either.
    } finally {
      setSent(true);
      setLoading(false);
    }
  }

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
          <h1 className="mb-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
            {t("forgotPassword.title")}
          </h1>

          {sent ? (
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {t("forgotPassword.success")}
            </p>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleSubmit();
              }}
              className="space-y-4"
            >
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {t("forgotPassword.description")}
              </p>
              <div>
                <Label htmlFor="email">{t("forgotPassword.email")}</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? t("forgotPassword.sending") : t("forgotPassword.submit")}
              </Button>
            </form>
          )}
        </Card>
        <p className="mt-4 text-center text-xs text-slate-400 dark:text-slate-500">
          <Link href="/login" className="underline hover:text-slate-600 dark:hover:text-slate-300">
            {t("forgotPassword.backToLogin")}
          </Link>
        </p>
      </div>
    </main>
  );
}
