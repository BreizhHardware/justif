"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import {
  BarChart2,
  ClipboardList,
  LayoutGrid,
  LogOut,
  Menu,
  Receipt,
  Settings,
  UploadCloud,
  Users,
  X,
} from "lucide-react";
import { apiFetch } from "@/lib/api";

const links = [
  { href: "/dashboard", icon: BarChart2, key: "dashboard" as const, adminOnly: false },
  { href: "/expenses", icon: Receipt, key: "expenses" as const, adminOnly: false },
  { href: "/upload", icon: UploadCloud, key: "upload" as const, adminOnly: false },
  { href: "/users", icon: Users, key: "users" as const, adminOnly: true },
  { href: "/audit", icon: ClipboardList, key: "audit" as const, adminOnly: true },
  { href: "/settings", icon: Settings, key: "settings" as const, adminOnly: true },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useTranslation();
  const [email, setEmail] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    apiFetch<{ email: string; role: string }>("/api/auth/me")
      .then((me) => {
        setEmail(me.email);
        setRole(me.role);
      })
      .catch(() => {});
  }, []);

  async function handleLogout() {
    await apiFetch("/api/auth/logout", { method: "POST" });
    localStorage.removeItem("justif_had_session");
    router.push("/");
  }

  const visibleLinks = links.filter((link) => !link.adminOnly || role === "admin");

  const sidebarContent = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-5 py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500">
          <LayoutGrid className="h-4.5 w-4.5 text-white" size={18} />
        </div>
        <span className="text-lg font-semibold text-white">{t("appName")}</span>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {visibleLinks.map(({ href, icon: Icon, key }) => {
          const active = pathname?.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                active
                  ? "bg-brand-500 text-white"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <Icon size={18} />
              {t(`nav.${key}`)}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-slate-800 px-3 py-4">
        {email && <p className="mb-2 truncate px-3 text-xs text-slate-400">{email}</p>}
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-slate-800 hover:text-white"
        >
          <LogOut size={18} />
          {t("nav.logout")}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 bg-slate-900 md:block">
        {sidebarContent}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 bg-slate-900">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-4 text-slate-400 hover:text-white"
            >
              <X size={20} />
            </button>
            {sidebarContent}
          </aside>
        </div>
      )}

      <div className="md:pl-64">
        <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 md:hidden">
          <button
            onClick={() => setMobileOpen(true)}
            className="text-slate-500 hover:text-slate-900"
          >
            <Menu size={22} />
          </button>
          <span className="text-base font-semibold text-slate-900">{t("appName")}</span>
        </header>

        <main className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
