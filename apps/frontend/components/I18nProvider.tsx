"use client";

// Ensures i18next is initialized and provides it to all child components.
import { useEffect } from "react";
import { I18nextProvider } from "react-i18next";
import i18n, { detectBrowserLocale, isSupportedLocale } from "@/lib/i18n";

const COOKIE_NAME = "justif_locale";
const COOKIE_MAX_AGE = 365 * 24 * 60 * 60;

function readLocaleCookie(): string | null {
  if (typeof document === "undefined") return null;
  const entry = document.cookie.split("; ").find((r) => r.startsWith(`${COOKIE_NAME}=`));
  const val = entry?.split("=")[1];
  return val && isSupportedLocale(val) ? val : null;
}

function writeLocaleCookie(locale: string) {
  document.cookie = `${COOKIE_NAME}=${locale}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const cookieLocale = readLocaleCookie();
    if (cookieLocale) {
      if (cookieLocale !== i18n.language) void i18n.changeLanguage(cookieLocale);
      return;
    }
    const detected = detectBrowserLocale();
    writeLocaleCookie(detected);
    if (detected !== i18n.language) void i18n.changeLanguage(detected);
  }, []);

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
