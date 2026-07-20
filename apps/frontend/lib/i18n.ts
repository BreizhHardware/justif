// Centralized i18n configuration using react-i18next.
// To add a new language: add a JSON file in locales/ and register it below.

import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import en from "../locales/en.json";
import fr from "../locales/fr.json";

export const SUPPORTED = ["en", "fr"] as const;
export type SupportedLocale = (typeof SUPPORTED)[number];

export function isSupportedLocale(lang: string): lang is SupportedLocale {
  return (SUPPORTED as readonly string[]).includes(lang);
}

/** Real browser language, only meaningful when called client-side (post-mount). */
export function detectBrowserLocale(): SupportedLocale {
  if (typeof navigator === "undefined") return "en";
  const lang = navigator.language.split("-")[0];
  return isSupportedLocale(lang) ? lang : "en";
}

void i18next.use(initReactI18next).init({
  lng: "en",
  resources: {
    en: { translation: en },
    fr: { translation: fr },
  },
  supportedLngs: [...SUPPORTED],
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

export default i18next;

/** BCP 47 locale tag for use with toLocaleString() and toLocaleDateString(). */
export function getLocaleTag(): string {
  return i18next.language === "fr" ? "fr-FR" : "en-US";
}

/**
 * Canonical DB values for expense categories.
 * These are always stored as French strings in the database regardless of UI locale.
 * Use t('categories.<value>') to get the localized display name.
 */
export type CategoryValue =
  | "Repas"
  | "Transport"
  | "Hébergement"
  | "Matériel"
  | "Logiciel"
  | "Formation"
  | "Autre";

export const CATEGORY_VALUES: readonly CategoryValue[] = [
  "Repas",
  "Transport",
  "Hébergement",
  "Matériel",
  "Logiciel",
  "Formation",
  "Autre",
];
