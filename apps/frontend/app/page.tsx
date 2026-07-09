"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, LayoutGrid, Receipt, ScanLine, Users } from "lucide-react";
import { Button } from "@/components/ui";
import { apiFetch } from "@/lib/api";

type AppState = "checking" | "setup_required" | "needs_login" | "session_expired" | "ready";

export const SESSION_KEY = "justif_had_session";

const FEATURES = [
  { icon: Receipt, label: "Importez et gérez vos justificatifs" },
  { icon: ScanLine, label: "Analyse OCR automatique" },
  { icon: Users, label: "Gestion multi-utilisateurs" },
];

export default function HomePage() {
  const router = useRouter();
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
        const hadSession = typeof window !== "undefined" && localStorage.getItem(SESSION_KEY) === "1";
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
        <span className="text-2xl font-bold text-slate-800">Justif</span>
      </div>

      {state === "checking" && (
        <div className="flex flex-col items-center gap-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand-400 border-t-transparent" />
          <p className="text-sm text-slate-400">Vérification de la session…</p>
        </div>
      )}

      {state === "setup_required" && (
        <div className="w-full max-w-sm">
          <div className="mb-5 text-center">
            <h1 className="text-xl font-semibold text-slate-800">Première installation</h1>
            <p className="mt-1.5 text-sm text-slate-500">
              Configurez Justif en quelques étapes pour gérer vos notes de frais.
            </p>
          </div>
          <ul className="mb-6 space-y-2">
            {FEATURES.map(({ icon: Icon, label }) => (
              <li
                key={label}
                className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
              >
                <Icon size={15} className="shrink-0 text-brand-500" />
                <span className="text-sm text-slate-700">{label}</span>
              </li>
            ))}
          </ul>
          <Button className="w-full" onClick={() => router.push("/setup")}>
            Configurer Justif <ArrowRight size={15} />
          </Button>
        </div>
      )}

      {state === "needs_login" && (
        <div className="w-full max-w-sm text-center">
          <h1 className="text-xl font-semibold text-slate-800">Bon retour</h1>
          <p className="mt-2 text-sm text-slate-500">
            Connectez-vous pour accéder à vos dépenses et exports.
          </p>
          <Button className="mt-6 w-full" onClick={() => router.push("/login")}>
            Se connecter <ArrowRight size={15} />
          </Button>
        </div>
      )}

      {state === "session_expired" && (
        <div className="w-full max-w-sm text-center">
          <h1 className="text-xl font-semibold text-slate-800">Session expirée</h1>
          <p className="mt-2 text-sm text-slate-500">
            Votre session a expiré. Reconnectez-vous pour continuer.
          </p>
          <Button className="mt-6 w-full" onClick={() => router.push("/login")}>
            Se reconnecter <ArrowRight size={15} />
          </Button>
        </div>
      )}

      {state === "ready" && (
        <p className="text-sm text-slate-400">Redirection…</p>
      )}
    </div>
  );
}
