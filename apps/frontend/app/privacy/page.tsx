"use client";

import Link from "next/link";
import { LayoutGrid } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Card } from "@/components/ui";

export default function PrivacyPage() {
  const { t } = useTranslation();

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-12 dark:bg-slate-950">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 flex flex-col items-center gap-2">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-500">
            <LayoutGrid className="text-white" size={22} />
          </div>
          <span className="text-xl font-semibold text-slate-900 dark:text-slate-100">
            {t("appName")}
          </span>
        </div>

        <Card className="space-y-6 p-8">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            {t("privacy.title")}
          </h1>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200">
              {t("privacy.controller.title")}
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {t("privacy.controller.body")}
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200">
              {t("privacy.collected.title")}
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {t("privacy.collected.intro")}
            </p>
            <ul className="list-inside list-disc space-y-1 text-sm text-slate-600 dark:text-slate-400">
              <li>{t("privacy.collected.credentials")}</li>
              <li>{t("privacy.collected.expenses")}</li>
              <li>{t("privacy.collected.receipts")}</li>
              <li>{t("privacy.collected.auditLogs")}</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200">
              {t("privacy.ip.title")}
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">{t("privacy.ip.body")}</p>
            <ul className="list-inside list-disc space-y-1 text-sm text-slate-600 dark:text-slate-400">
              <li>{t("privacy.ip.reason1")}</li>
              <li>{t("privacy.ip.reason2")}</li>
              <li>{t("privacy.ip.reason3")}</li>
            </ul>
            <p className="text-sm text-slate-600 dark:text-slate-400">{t("privacy.ip.basis")}</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200">
              {t("privacy.retention.title")}
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {t("privacy.retention.body")}
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200">
              {t("privacy.rights.title")}
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {t("privacy.rights.intro")}
            </p>
            <ul className="list-inside list-disc space-y-1 text-sm text-slate-600 dark:text-slate-400">
              <li>{t("privacy.rights.access")}</li>
              <li>{t("privacy.rights.erasure")}</li>
              <li>{t("privacy.rights.erasureNote")}</li>
              <li>{t("privacy.rights.portability")}</li>
            </ul>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {t("privacy.rights.contact")}
            </p>
          </section>
        </Card>

        <p className="mt-6 text-center text-xs text-slate-400 dark:text-slate-500">
          <Link href="/login" className="underline hover:text-slate-600 dark:hover:text-slate-300">
            {t("privacy.backToLogin")}
          </Link>
        </p>
      </div>
    </main>
  );
}
