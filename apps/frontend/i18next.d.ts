// Typed translation keys — gives autocompletion and compile-time checks for t('key').
import "react-i18next";
import type en from "./locales/en.json";

declare module "react-i18next" {
  interface CustomTypeOptions {
    resources: {
      translation: typeof en;
    };
  }
}
