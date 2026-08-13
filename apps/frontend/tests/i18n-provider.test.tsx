import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, waitFor } from "@testing-library/react";

import { I18nProvider } from "@/components/I18nProvider";
import i18n, { resolveLocale, type SupportedLocale } from "@/lib/i18n";

function setNavigatorLanguage(lang: string) {
  Object.defineProperty(navigator, "language", { value: lang, configurable: true });
}

function readCookie(): string | undefined {
  return document.cookie
    .split("; ")
    .find((r) => r.startsWith("justif_locale="))
    ?.split("=")[1];
}

/** Mirrors what app/layout.tsx resolves server-side from the request cookie. */
function serverResolvedLocale(): SupportedLocale {
  return resolveLocale(readCookie());
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
      <I18nProvider initialLocale={serverResolvedLocale()}>
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
      <I18nProvider initialLocale={serverResolvedLocale()}>
        <div />
      </I18nProvider>,
    );

    await waitFor(() => {
      expect(document.cookie).toContain("justif_locale=en");
    });
    expect(i18n.language).toBe("en");
  });

  it("applies the server-resolved locale from the persisted cookie immediately, without waiting for browser detection", () => {
    document.cookie = "justif_locale=fr; path=/";
    setNavigatorLanguage("en-US");
    render(
      <I18nProvider initialLocale={serverResolvedLocale()}>
        <div />
      </I18nProvider>,
    );

    // No waitFor: this must already hold synchronously on the render that
    // produced the initial (SSR-matching) paint.
    expect(i18n.language).toBe("fr");
  });

  it("normalizes an unsupported cookie value to 'en' and skips post-mount browser detection", async () => {
    document.cookie = "justif_locale=de; path=/";
    setNavigatorLanguage("fr-FR");
    render(
      <I18nProvider initialLocale={serverResolvedLocale()}>
        <div />
      </I18nProvider>,
    );

    expect(i18n.language).toBe("en");
    // The (invalid-but-present) cookie means a locale was already resolved
    // server-side, so post-mount browser detection must not override it.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(i18n.language).toBe("en");
  });
});
