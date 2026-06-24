"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LayoutGrid } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { t } from "@/lib/i18n";
import { Button, Card, Input, Label } from "@/components/ui";

export default function SetupPage() {
  const router = useRouter();
  const i18n = t();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    apiFetch<{ setupComplete: boolean }>("/api/auth/status").then((status) => {
      if (status.setupComplete) router.replace("/login");
    });
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await apiFetch("/api/auth/setup", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      router.push("/expenses");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-500">
            <LayoutGrid className="text-white" size={22} />
          </div>
          <span className="text-xl font-semibold text-slate-900">{i18n.appName}</span>
        </div>

        <Card className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
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
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" disabled={loading} className="w-full">
              {i18n.setup.submit}
            </Button>
          </form>
        </Card>
      </div>
    </main>
  );
}
