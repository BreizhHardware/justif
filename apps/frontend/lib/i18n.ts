// Centralized i18n configuration using react-i18next.
// Language is auto-detected from navigator.language and falls back to English.
// To add a new language: add a JSON file in locales/ and register it below.

import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import en from "../locales/en.json";
import fr from "../locales/fr.json";

const SUPPORTED = ["en", "fr"] as const;

function detectLanguage(): (typeof SUPPORTED)[number] {
  if (typeof navigator === "undefined") return "en";
  const lang = navigator.language.split("-")[0];
  return (SUPPORTED as readonly string[]).includes(lang)
    ? (lang as (typeof SUPPORTED)[number])
    : "en";
}

void i18next.use(initReactI18next).init({
  lng: detectLanguage(),
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
