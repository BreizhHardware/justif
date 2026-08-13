// Pure locale helpers with no i18next/react-i18next dependency.

export const SUPPORTED = ["en", "fr"] as const;
export type SupportedLocale = (typeof SUPPORTED)[number];

export function isSupportedLocale(lang: string): lang is SupportedLocale {
  return (SUPPORTED as readonly string[]).includes(lang);
}

/** Resolves a `justif_locale` cookie value (server or client) to a supported locale. */
export function resolveLocale(cookieValue: string | null | undefined): SupportedLocale {
  return cookieValue && isSupportedLocale(cookieValue) ? cookieValue : "en";
}
