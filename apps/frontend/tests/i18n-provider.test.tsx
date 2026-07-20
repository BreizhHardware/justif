import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, waitFor } from "@testing-library/react";

import { I18nProvider } from "@/components/I18nProvider";
import i18n from "@/lib/i18n";

function setNavigatorLanguage(lang: string) {
  Object.defineProperty(navigator, "language", { value: lang, configurable: true });
}

describe("I18nProvider", () => {
  const originalLanguage = navigator.language;

  beforeEach(async () => {
    document.cookie = "justif_locale=; max-age=0; path=/";
    await i18n.changeLanguage("en");
  });

  afterEach(async () => {
    setNavigatorLanguage(originalLanguage);
    document.cookie = "justif_locale=; max-age=0; path=/";
    await i18n.changeLanguage("en");
  });

  it("detects the browser language post-mount when no cookie is present", async () => {
    setNavigatorLanguage("fr-FR");
    render(
      <I18nProvider>
        <div />
      </I18nProvider>,
    );

    await waitFor(() => {
      expect(i18n.language).toBe("fr");
    });
    expect(document.cookie).toContain("justif_locale=fr");
  });

  it("falls back to 'en' post-mount for an unsupported browser language", async () => {
    setNavigatorLanguage("de-DE");
    render(
      <I18nProvider>
        <div />
      </I18nProvider>,
    );

    await waitFor(() => {
      expect(document.cookie).toContain("justif_locale=en");
    });
    expect(i18n.language).toBe("en");
  });

  it("prefers the persisted cookie over the browser language", async () => {
    document.cookie = "justif_locale=fr; path=/";
    setNavigatorLanguage("en-US");
    render(
      <I18nProvider>
        <div />
      </I18nProvider>,
    );

    await waitFor(() => {
      expect(i18n.language).toBe("fr");
    });
  });

  it("ignores an unsupported cookie value and falls back to browser detection", async () => {
    document.cookie = "justif_locale=de; path=/";
    setNavigatorLanguage("fr-FR");
    render(
      <I18nProvider>
        <div />
      </I18nProvider>,
    );

    await waitFor(() => {
      expect(i18n.language).toBe("fr");
    });
  });
});
