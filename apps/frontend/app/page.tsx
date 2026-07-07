"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui";
import { apiFetch, ApiError } from "@/lib/api";

type AppState = "checking" | "setup_required" | "needs_login" | "ready";

export default function HomePage() {
  const router = useRouter();
  const [state, setState] = useState<AppState>("checking");

  useEffect(() => {
    async function check() {
      try {
        const status = await apiFetch<{ setupComplete: boolean }>("/api/auth/status");
        if (!status.setupComplete) {
          setState("setup_required");
          return;
        }
        await apiFetch("/api/auth/me");
        setState("ready");
        router.replace("/dashboard");
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          setState("needs_login");
        } else {
          setState("needs_login");
        }
      }
    }
    check();
  }, [router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4">
      {/* Logo */}
      <div className="mb-8 flex flex-col items-center gap-3">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500 shadow-lg">
          <LayoutGrid className="text-white" size={28} />
        </div>
        <span className="text-2xl font-bold text-slate-800">Justif</span>
      </div>

      {state === "checking" && (
        <div className="flex flex-col items-center gap-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand-400 border-t-transparent" />
          <p className="text-sm text-slate-400">Vérification de la session…</p>
        </div>
      )}

      {state === "setup_required" && (
        <div className="w-full max-w-sm text-center">
          <h1 className="text-xl font-semibold text-slate-800">Première configuration</h1>
          <p className="mt-2 text-sm text-slate-500">
            Aucun compte n'existe encore. Créez votre compte administrateur pour démarrer.
          </p>
          <Button
            className="mt-6 w-full"
            onClick={() => router.push("/setup")}
          >
            Configurer Justif
          </Button>
        </div>
      )}

      {state === "needs_login" && (
        <div className="w-full max-w-sm text-center">
          <h1 className="text-xl font-semibold text-slate-800">Bon retour</h1>
          <p className="mt-2 text-sm text-slate-500">
            Connectez-vous pour accéder à vos dépenses et exports.
          </p>
          <Button
            className="mt-6 w-full"
            onClick={() => router.push("/login")}
          >
            Se connecter
          </Button>
        </div>
      )}

      {state === "ready" && (
        <p className="text-sm text-slate-400">Redirection…</p>
      )}
    </div>
  );
}
