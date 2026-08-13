"use client";

// Ensures i18next is initialized and provides it to all child components.
import { useEffect } from "react";
import { I18nextProvider } from "react-i18next";
import i18n, { detectBrowserLocale } from "@/lib/i18n";
import type { SupportedLocale } from "@/lib/i18n";

const COOKIE_NAME = "justif_locale";
const COOKIE_MAX_AGE = 365 * 24 * 60 * 60;

function hasLocaleCookie(): boolean {
  return document.cookie.split("; ").some((r) => r.startsWith(`${COOKIE_NAME}=`));
}

function writeLocaleCookie(locale: string) {
  document.cookie = `${COOKIE_NAME}=${locale}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
}

export function I18nProvider({
  children,
  initialLocale,
}: {
  children: React.ReactNode;
  initialLocale: SupportedLocale;
}) {
  if (i18n.language !== initialLocale) {
    void i18n.changeLanguage(initialLocale);
  }

  useEffect(() => {
    if (hasLocaleCookie()) return;
    const detected = detectBrowserLocale();
    writeLocaleCookie(detected);
    if (detected !== i18n.language) void i18n.changeLanguage(detected);
  }, []);

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
