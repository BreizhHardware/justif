"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { ArrowRight, LayoutGrid, Receipt, ScanLine, Users } from "lucide-react";
import { Button } from "@/components/ui";
import { apiFetch } from "@/lib/api";

type AppState = "checking" | "setup_required" | "needs_login" | "session_expired" | "ready";

export const SESSION_KEY = "justif_had_session";

const FEATURE_ICONS = [Receipt, ScanLine, Users];
const FEATURE_KEYS = ["home.feature1", "home.feature2", "home.feature3"] as const;

export default function HomePage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [state, setState] = useState<AppState>("checking");

  useEffect(() => {
    async function check() {
      let setupComplete: boolean;
      try {
        const status = await apiFetch<{ setupComplete: boolean }>("/api/auth/status");
        setupComplete = status.setupComplete;
      } catch {
        setState("setup_required");
        return;
      }

      if (!setupComplete) {
        setState("setup_required");
        return;
      }

      try {
        await apiFetch("/api/auth/me");
        setState("ready");
        router.replace("/dashboard");
      } catch {
        const hadSession =
          typeof window !== "undefined" && localStorage.getItem(SESSION_KEY) === "1";
        setState(hadSession ? "session_expired" : "needs_login");
      }
    }
    check();
  }, [router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 py-12">
      {/* Logo */}
      <div className="mb-8 flex flex-col items-center gap-3">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500 shadow-lg">
          <LayoutGrid className="text-white" size={28} />
        </div>
        <span className="text-2xl font-bold text-slate-800">{t("appName")}</span>
      </div>

      {state === "checking" && (
        <div className="flex flex-col items-center gap-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand-400 border-t-transparent" />
          <p className="text-sm text-slate-400">{t("home.checking")}</p>
        </div>
      )}

      {state === "setup_required" && (
        <div className="w-full max-w-sm">
          <div className="mb-5 text-center">
            <h1 className="text-xl font-semibold text-slate-800">{t("home.setupTitle")}</h1>
            <p className="mt-1.5 text-sm text-slate-500">{t("home.setupDescription")}</p>
          </div>
          <ul className="mb-6 space-y-2">
            {FEATURE_KEYS.map((key, i) => {
              const Icon = FEATURE_ICONS[i];
              return (
                <li
                  key={key}
                  className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
                >
                  <Icon size={15} className="shrink-0 text-brand-500" />
                  <span className="text-sm text-slate-700">{t(key)}</span>
                </li>
              );
            })}
          </ul>
          <Button className="w-full" onClick={() => router.push("/setup")}>
            {t("home.setupCta")} <ArrowRight size={15} />
          </Button>
        </div>
      )}

      {state === "needs_login" && (
        <div className="w-full max-w-sm text-center">
          <h1 className="text-xl font-semibold text-slate-800">{t("home.welcomeTitle")}</h1>
          <p className="mt-2 text-sm text-slate-500">{t("home.welcomeDescription")}</p>
          <Button className="mt-6 w-full" onClick={() => router.push("/login")}>
            {t("home.signIn")} <ArrowRight size={15} />
          </Button>
        </div>
      )}

      {state === "session_expired" && (
        <div className="w-full max-w-sm text-center">
          <h1 className="text-xl font-semibold text-slate-800">{t("home.sessionExpiredTitle")}</h1>
          <p className="mt-2 text-sm text-slate-500">{t("home.sessionExpiredDescription")}</p>
          <Button className="mt-6 w-full" onClick={() => router.push("/login")}>
            {t("home.reconnect")} <ArrowRight size={15} />
          </Button>
        </div>
      )}

      {state === "ready" && <p className="text-sm text-slate-400">{t("home.redirecting")}</p>}
    </div>
  );
}
